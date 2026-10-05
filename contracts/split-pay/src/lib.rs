#![no_std]

//! Split Pay: one payment in, many payouts out.
//!
//! A creator, a band, a marketplace or a DAO registers a *split*: a list
//! of recipients and their shares (in basis points, summing to 100%).
//! Anyone can then pay into that split in any Stellar asset, and the
//! contract forwards each recipient's share in the same transaction.
//!
//! The contract never custodies funds: every `pay` moves tokens straight
//! from the payer to the recipients, so there is no balance to drain and
//! no withdrawal step to forget. Rounding dust (at most one unit per
//! recipient) goes to the first recipient, so the full amount always
//! lands and nothing is ever stuck in the contract.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Vec,
};

/// 100% expressed in basis points.
pub const TOTAL_BPS: u32 = 10_000;
/// Upper bound on recipients so a single `pay` stays well inside the
/// per-transaction resource limits.
pub const MAX_RECIPIENTS: u32 = 20;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recipient {
    pub address: Address,
    /// Share of every payment, in basis points (1 bp = 0.01%).
    pub share_bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub id: u64,
    pub owner: Address,
    pub recipients: Vec<Recipient>,
    /// Owners can freeze a split so its recipients can rely on it never
    /// changing (useful for published royalty agreements).
    pub locked: bool,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Split(u64),
    /// Owner-to-be awaiting `accept_ownership`.
    PendingOwner(u64),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    SplitNotFound = 1,
    NotOwner = 2,
    InvalidShares = 3,
    NoRecipients = 4,
    TooManyRecipients = 5,
    DuplicateRecipient = 6,
    InvalidAmount = 7,
    SplitLocked = 8,
    NoPendingOwner = 9,
}

#[contractevent(topics = ["split", "created"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitCreated {
    pub split_id: u64,
}

#[contractevent(topics = ["split", "updated"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitUpdated {
    pub split_id: u64,
}

#[contractevent(topics = ["split", "locked"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitLockedEvent {
    pub split_id: u64,
}

#[contractevent(topics = ["split", "owner"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipTransferred {
    #[topic]
    pub split_id: u64,
    pub from: Address,
    pub to: Address,
}

#[contractevent(topics = ["split", "proposed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipProposed {
    #[topic]
    pub split_id: u64,
    pub from: Address,
    pub to: Address,
}

#[contractevent(topics = ["split", "paid"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitPaid {
    #[topic]
    pub split_id: u64,
    pub payer: Address,
    pub token: Address,
    pub amount: i128,
    /// What each recipient received, in recipient order (dust included).
    pub payouts: Vec<i128>,
}

// Keep live splits from being archived: bumped on every write and payment.
const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contract]
pub struct SplitPayContract;

#[contractimpl]
impl SplitPayContract {
    /// Register a new split owned by `owner`. Returns its id.
    pub fn create_split(
        env: Env,
        owner: Address,
        recipients: Vec<Recipient>,
    ) -> Result<u64, Error> {
        owner.require_auth();
        validate(&recipients)?;

        let id = next_id(&env);
        let split = Split {
            id,
            owner,
            recipients,
            locked: false,
        };
        save(&env, &split);
        SplitCreated { split_id: id }.publish(&env);
        Ok(id)
    }

    /// Replace a split's recipients. Owner only, and only while unlocked.
    pub fn update_split(env: Env, split_id: u64, recipients: Vec<Recipient>) -> Result<(), Error> {
        let mut split = Self::get_split(env.clone(), split_id)?;
        split.owner.require_auth();
        if split.locked {
            return Err(Error::SplitLocked);
        }
        validate(&recipients)?;

        split.recipients = recipients;
        save(&env, &split);
        SplitUpdated { split_id }.publish(&env);
        Ok(())
    }

    /// Permanently freeze a split's recipients. Irreversible.
    pub fn lock_split(env: Env, split_id: u64) -> Result<(), Error> {
        let mut split = Self::get_split(env.clone(), split_id)?;
        split.owner.require_auth();
        if split.locked {
            return Err(Error::SplitLocked);
        }
        split.locked = true;
        save(&env, &split);
        SplitLockedEvent { split_id }.publish(&env);
        Ok(())
    }

    /// Step 1 of a safe handover: name the next owner. Nothing changes until
    /// they call `accept_ownership`, so a typo can't lose the split. Owner only.
    pub fn propose_owner(env: Env, split_id: u64, new_owner: Address) -> Result<(), Error> {
        let split = Self::get_split(env.clone(), split_id)?;
        split.owner.require_auth();
        let key = DataKey::PendingOwner(split_id);
        env.storage().persistent().set(&key, &new_owner);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        OwnershipProposed {
            split_id,
            from: split.owner,
            to: new_owner,
        }
        .publish(&env);
        Ok(())
    }

    /// Step 2: the proposed owner takes over.
    pub fn accept_ownership(env: Env, split_id: u64) -> Result<(), Error> {
        let mut split = Self::get_split(env.clone(), split_id)?;
        let key = DataKey::PendingOwner(split_id);
        let next: Address = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NoPendingOwner)?;
        next.require_auth();
        let from = split.owner.clone();
        split.owner = next.clone();
        env.storage().persistent().remove(&key);
        save(&env, &split);
        OwnershipTransferred {
            split_id,
            from,
            to: next,
        }
        .publish(&env);
        Ok(())
    }

    /// Withdraw a pending proposal. Owner only.
    pub fn cancel_ownership_transfer(env: Env, split_id: u64) -> Result<(), Error> {
        let split = Self::get_split(env.clone(), split_id)?;
        split.owner.require_auth();
        let key = DataKey::PendingOwner(split_id);
        if !env.storage().persistent().has(&key) {
            return Err(Error::NoPendingOwner);
        }
        env.storage().persistent().remove(&key);
        Ok(())
    }

    pub fn pending_owner(env: Env, split_id: u64) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::PendingOwner(split_id))
    }

    /// Hand the split to a new owner immediately. Prefer `propose_owner` +
    /// `accept_ownership`, which can't be lost to a mistyped address.
    pub fn transfer_ownership(env: Env, split_id: u64, new_owner: Address) -> Result<(), Error> {
        let mut split = Self::get_split(env.clone(), split_id)?;
        split.owner.require_auth();
        let from = split.owner.clone();
        split.owner = new_owner.clone();
        env.storage()
            .persistent()
            .remove(&DataKey::PendingOwner(split_id));
        save(&env, &split);
        OwnershipTransferred {
            split_id,
            from,
            to: new_owner,
        }
        .publish(&env);
        Ok(())
    }

    /// Pay `amount` of `token` into a split. Each recipient receives their
    /// share directly from `payer`; rounding dust goes to the first one.
    pub fn pay(
        env: Env,
        split_id: u64,
        payer: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        payer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let split = Self::get_split(env.clone(), split_id)?;
        let shares = payout_amounts(&env, &split.recipients, amount)?;

        let client = token::Client::new(&env, &token);
        for (i, recipient) in split.recipients.iter().enumerate() {
            let share = shares.get(i as u32).unwrap();
            if share > 0 {
                client.transfer(&payer, &recipient.address, &share);
            }
        }

        // Only the TTL needs refreshing; the split itself is unchanged.
        bump(&env, split_id);
        SplitPaid {
            split_id,
            payer,
            token,
            amount,
            payouts: shares,
        }
        .publish(&env);
        Ok(())
    }

    /// Preview how `amount` would be divided, without moving anything.
    pub fn preview(env: Env, split_id: u64, amount: i128) -> Result<Vec<i128>, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let split = Self::get_split(env.clone(), split_id)?;
        payout_amounts(&env, &split.recipients, amount)
    }

    pub fn get_split(env: Env, split_id: u64) -> Result<Split, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Split(split_id))
            .ok_or(Error::SplitNotFound)
    }

    pub fn split_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(0)
    }
}

fn validate(recipients: &Vec<Recipient>) -> Result<(), Error> {
    let n = recipients.len();
    if n == 0 {
        return Err(Error::NoRecipients);
    }
    if n > MAX_RECIPIENTS {
        return Err(Error::TooManyRecipients);
    }
    let mut total: u32 = 0;
    for (i, r) in recipients.iter().enumerate() {
        if r.share_bps == 0 {
            return Err(Error::InvalidShares);
        }
        total = total.checked_add(r.share_bps).ok_or(Error::InvalidShares)?;
        for later in recipients.iter().skip(i + 1) {
            if later.address == r.address {
                return Err(Error::DuplicateRecipient);
            }
        }
    }
    if total != TOTAL_BPS {
        return Err(Error::InvalidShares);
    }
    Ok(())
}

/// Pro-rata amounts per recipient, in recipient order. Integer division
/// rounds each share down; the remainder goes to recipient 0 so the
/// amounts always sum to exactly `amount`.
fn payout_amounts(
    env: &Env,
    recipients: &Vec<Recipient>,
    amount: i128,
) -> Result<Vec<i128>, Error> {
    let mut out = Vec::new(env);
    let mut distributed: i128 = 0;
    for r in recipients.iter() {
        let share = amount
            .checked_mul(r.share_bps as i128)
            .ok_or(Error::InvalidAmount)?
            / (TOTAL_BPS as i128);
        distributed += share;
        out.push_back(share);
    }
    let dust = amount - distributed;
    if dust > 0 {
        let first = out.get(0).unwrap();
        out.set(0, first + dust);
    }
    Ok(out)
}

fn save(env: &Env, split: &Split) {
    env.storage()
        .persistent()
        .set(&DataKey::Split(split.id), split);
    bump(env, split.id);
}

/// Keep a split and the contract instance (which holds the id counter) alive.
fn bump(env: &Env, split_id: u64) {
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Split(split_id), BUMP_THRESHOLD, BUMP_TO);
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn next_id(env: &Env) -> u64 {
    let next: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextId)
        .unwrap_or(0u64)
        + 1;
    env.storage().instance().set(&DataKey::NextId, &next);
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
    next
}

mod test;

#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, vec, Env};

struct Setup<'a> {
    env: Env,
    client: SplitPayContractClient<'a>,
    token: Address,
    token_client: token::Client<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(SplitPayContract, ());
    let client = SplitPayContractClient::new(&env, &id);
    let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let token = sac.address();
    let token_client = token::Client::new(&env, &token);
    Setup {
        env,
        client,
        token,
        token_client,
    }
}

fn r(env: &Env, share_bps: u32) -> Recipient {
    Recipient {
        address: Address::generate(env),
        share_bps,
    }
}

fn mint(s: &Setup, to: &Address, amount: i128) {
    StellarAssetClient::new(&s.env, &s.token).mint(to, &amount);
}

#[test]
fn creates_a_split() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let recipients = vec![&s.env, r(&s.env, 7_000), r(&s.env, 3_000)];

    let id = s.client.create_split(&owner, &recipients);

    assert_eq!(id, 1);
    let split = s.client.get_split(&id);
    assert_eq!(split.owner, owner);
    assert_eq!(split.recipients, recipients);
    assert!(!split.locked);
    assert_eq!(s.client.split_count(), 1);
}

#[test]
fn rejects_shares_that_do_not_sum_to_100_percent() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let short = vec![&s.env, r(&s.env, 5_000), r(&s.env, 4_999)];
    let over = vec![&s.env, r(&s.env, 6_000), r(&s.env, 4_001)];

    assert_eq!(
        s.client.try_create_split(&owner, &short),
        Err(Ok(Error::InvalidShares))
    );
    assert_eq!(
        s.client.try_create_split(&owner, &over),
        Err(Ok(Error::InvalidShares))
    );
}

#[test]
fn rejects_empty_zero_share_duplicate_and_oversized_splits() {
    let s = setup();
    let owner = Address::generate(&s.env);

    assert_eq!(
        s.client.try_create_split(&owner, &Vec::new(&s.env)),
        Err(Ok(Error::NoRecipients))
    );
    assert_eq!(
        s.client
            .try_create_split(&owner, &vec![&s.env, r(&s.env, 10_000), r(&s.env, 0)]),
        Err(Ok(Error::InvalidShares))
    );

    let dup = r(&s.env, 5_000);
    assert_eq!(
        s.client
            .try_create_split(&owner, &vec![&s.env, dup.clone(), dup]),
        Err(Ok(Error::DuplicateRecipient))
    );

    let mut many = Vec::new(&s.env);
    for _ in 0..=MAX_RECIPIENTS {
        many.push_back(r(&s.env, 1));
    }
    assert_eq!(
        s.client.try_create_split(&owner, &many),
        Err(Ok(Error::TooManyRecipients))
    );
}

#[test]
fn pay_forwards_each_share_directly_to_recipients() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let payer = Address::generate(&s.env);
    let artist = r(&s.env, 6_000);
    let producer = r(&s.env, 2_500);
    let label = r(&s.env, 1_500);
    let id = s.client.create_split(
        &owner,
        &vec![&s.env, artist.clone(), producer.clone(), label.clone()],
    );
    mint(&s, &payer, 1_000_000);

    s.client.pay(&id, &payer, &s.token, &1_000_000);

    assert_eq!(s.token_client.balance(&artist.address), 600_000);
    assert_eq!(s.token_client.balance(&producer.address), 250_000);
    assert_eq!(s.token_client.balance(&label.address), 150_000);
    assert_eq!(s.token_client.balance(&payer), 0);
    // Nothing is ever held by the contract.
    assert_eq!(s.token_client.balance(&s.client.address), 0);
}

#[test]
fn rounding_dust_goes_to_the_first_recipient_and_nothing_is_lost() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let payer = Address::generate(&s.env);
    let a = r(&s.env, 3_334);
    let b = r(&s.env, 3_333);
    let c = r(&s.env, 3_333);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, a.clone(), b.clone(), c.clone()]);
    mint(&s, &payer, 10);

    s.client.pay(&id, &payer, &s.token, &10);

    // 10 * 33.33% rounds down to 3 each = 9; the 1 unit of dust goes to `a`.
    assert_eq!(s.token_client.balance(&a.address), 4);
    assert_eq!(s.token_client.balance(&b.address), 3);
    assert_eq!(s.token_client.balance(&c.address), 3);
    assert_eq!(s.token_client.balance(&payer), 0);
}

#[test]
fn preview_matches_what_pay_sends() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, r(&s.env, 3_334), r(&s.env, 6_666)]);

    assert_eq!(s.client.preview(&id, &10), vec![&s.env, 4i128, 6i128]);
}

#[test]
fn rejects_zero_and_negative_payments() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let payer = Address::generate(&s.env);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, r(&s.env, 10_000)]);

    assert_eq!(
        s.client.try_pay(&id, &payer, &s.token, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.client.try_pay(&id, &payer, &s.token, &-5),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn paying_an_unknown_split_fails() {
    let s = setup();
    let payer = Address::generate(&s.env);
    assert_eq!(
        s.client.try_pay(&42, &payer, &s.token, &100),
        Err(Ok(Error::SplitNotFound))
    );
}

#[test]
fn owner_can_update_until_locked() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, r(&s.env, 10_000)]);
    let replacement = vec![&s.env, r(&s.env, 5_000), r(&s.env, 5_000)];

    s.client.update_split(&id, &replacement);
    assert_eq!(s.client.get_split(&id).recipients, replacement);

    s.client.lock_split(&id);
    assert!(s.client.get_split(&id).locked);
    assert_eq!(
        s.client
            .try_update_split(&id, &vec![&s.env, r(&s.env, 10_000)]),
        Err(Ok(Error::SplitLocked))
    );
    assert_eq!(s.client.try_lock_split(&id), Err(Ok(Error::SplitLocked)));
}

#[test]
fn update_still_validates_shares() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, r(&s.env, 10_000)]);
    assert_eq!(
        s.client
            .try_update_split(&id, &vec![&s.env, r(&s.env, 9_000)]),
        Err(Ok(Error::InvalidShares))
    );
}

#[test]
#[should_panic]
fn only_the_owner_can_update() {
    let env = Env::default();
    let id = env.register(SplitPayContract, ());
    let client = SplitPayContractClient::new(&env, &id);
    let owner = Address::generate(&env);
    let recipients = vec![&env, r(&env, 10_000)];

    env.mock_all_auths();
    let split_id = client.create_split(&owner, &recipients);

    // No auths mocked from here: the owner hasn't signed, so this must fail.
    env.set_auths(&[]);
    client.update_split(&split_id, &recipients);
}

#[test]
fn ownership_can_be_transferred() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let multisig = Address::generate(&s.env);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, r(&s.env, 10_000)]);

    s.client.transfer_ownership(&id, &multisig);

    assert_eq!(s.client.get_split(&id).owner, multisig);
}

#[test]
fn works_with_any_number_of_tokens() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let payer = Address::generate(&s.env);
    let a = r(&s.env, 5_000);
    let b = r(&s.env, 5_000);
    let id = s
        .client
        .create_split(&owner, &vec![&s.env, a.clone(), b.clone()]);

    let other = s
        .env
        .register_stellar_asset_contract_v2(Address::generate(&s.env))
        .address();
    StellarAssetClient::new(&s.env, &other).mint(&payer, &200);
    mint(&s, &payer, 100);

    s.client.pay(&id, &payer, &s.token, &100);
    s.client.pay(&id, &payer, &other, &200);

    assert_eq!(s.token_client.balance(&a.address), 50);
    assert_eq!(token::Client::new(&s.env, &other).balance(&b.address), 100);
}

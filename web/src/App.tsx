import { Shell, NotFound } from "./Shell";
import { Workspace } from "./Workspace";
import { Docs } from "./pages/Docs";
import { Home } from "./pages/Home";
import { useRoute, useTitle } from "./lib/router";
import { useWallet } from "./lib/useWallet";

function AppPage({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  useTitle("App · Split Pay");
  return <Workspace wallet={wallet} />;
}

export default function App() {
  const route = useRoute();
  const wallet = useWallet();
  return (
    <Shell route={route} wallet={wallet}>
      {route === "/" ? <Home /> : route === "/app" ? <AppPage wallet={wallet} /> : route === "/docs" ? <Docs /> : <NotFound />}
    </Shell>
  );
}

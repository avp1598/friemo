import "../styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { AppProps } from "next/app";
import {
  RainbowKitProvider,
  getDefaultWallets,
  createAuthenticationAdapter,
  RainbowKitAuthenticationProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { chain, configureChains, createClient, WagmiConfig } from "wagmi";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";
import { useEffect, useState } from "react";
import { SiweMessage } from "siwe";

const { chains, provider, webSocketProvider } = configureChains(
  [
    chain.mainnet,
    chain.polygon,
    chain.optimism,
    chain.arbitrum,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true"
      ? [chain.goerli, chain.kovan, chain.rinkeby, chain.ropsten]
      : []),
  ],
  [
    alchemyProvider({
      apiKey: "gRV8E8H-ok8nzUOAdR4YY_bCM5BCoqy5",
    }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: "RainbowKit App",
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

function MyApp({ Component, pageProps }: AppProps) {
  const [authenticationStatus, setAuthenticationStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("unauthenticated");

  useEffect(() => {
    (async () => {
      try {
        const me = await (
          await fetch(`https://proxy.spect.network/api/user/me`, {
            headers: {
              Authorization: `Bearer SPECT_BETA_API_TOKEN`,
            },
            credentials: "include",
          })
        ).json();
        console.log({ me });
      } catch (e) {
        console.log(e);
      }
    })();
  }, []);

  const authenticationAdapter = createAuthenticationAdapter({
    getNonce: async () => {
      console.log("hi");
      const response = await fetch(
        `https://proxy.spect.network/api/auth/nonce`,
        {
          headers: {
            Authorization: `Bearer SPECT_BETA_API_TOKEN`,
          },
          credentials: "include",
        }
      );
      const res = await response.text();
      return res;
    },
    createMessage: ({ nonce, address, chainId }) => {
      return new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in with Ethereum to the app.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });
    },
    getMessageBody: ({ message }) => {
      return message.prepareMessage();
    },
    verify: async ({ message, signature }) => {
      console.log({ signature });
      const verifyRes: any = await fetch(
        `https://proxy.spect.network/api/auth/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer SPECT_BETA_API_TOKEN`,
          },
          body: JSON.stringify({
            message,
            signature,
          }),
          credentials: "include",
        }
      );
      console.log({ verifyRes });
      setAuthenticationStatus(
        verifyRes.ok ? "authenticated" : "unauthenticated"
      );
      return Boolean(verifyRes.ok);
    },
    signOut: async () => {
      await fetch(`/api/auth/logout`, {
        method: "POST",
      });
      setAuthenticationStatus("unauthenticated");
    },
  });

  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitAuthenticationProvider
        adapter={authenticationAdapter}
        status={authenticationStatus}
      >
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme()}
          modalSize="compact"
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </RainbowKitAuthenticationProvider>
    </WagmiConfig>
  );
}

export default MyApp;

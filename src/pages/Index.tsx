import { Helmet } from "react-helmet-async";
import { AuthScreen } from "@/components/grc/AuthScreen";

const Index = () => (
  <>
    <Helmet>
      <title>Sign In · Rsolve GRC Platform</title>
      <meta name="description" content="Secure access to the Rsolve unified Governance, Risk and Compliance platform." />
      <link rel="canonical" href="/" />
    </Helmet>
    <AuthScreen />
  </>
);

export default Index;

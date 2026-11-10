import { Redirect } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

// Окремої головної немає: корінь сайту відкриває першу статтю (з урахуванням мови)
export default function Home() {
  return <Redirect to={useBaseUrl("/getting-started")} />;
}

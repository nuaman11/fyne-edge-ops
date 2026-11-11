import Link from "next/link";
export default function NotFound() {
  return <div style={{ padding: 40 }}><h1>Page not found</h1><p><Link href="/">Back to the overview</Link></p></div>;
}

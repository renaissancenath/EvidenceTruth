import { Link } from "react-router";

export function NotFound() {
  return <div className="page stack"><h1>Page not found</h1><p>This address doesn't exist.</p><p><Link to="/">Go to the start</Link></p></div>;
}

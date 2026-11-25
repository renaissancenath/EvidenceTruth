import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { reportClientError } from "../api";

export function RouteError() {
  const err = useRouteError();
  useEffect(() => { reportClientError(err, location.pathname); }, [err]);
  return (
    <div className="page stack">
      <h1>This page failed to load</h1>
      <p>We recorded the error. Reload the page, or go back to the start.</p>
      <p className="row"><Link className="btn btn-primary" to="/app">Back to the app</Link><Link to="/report">Report a problem</Link></p>
    </div>
  );
}

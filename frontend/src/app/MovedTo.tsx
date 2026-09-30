import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * An old address, sent on to its new home WITH the rest of the path.
 *
 * A plain <Navigate to="/population/residents"> on "/residents/*" drops
 * everything after the prefix: a bookmark to one person, and every link the
 * system itself still built the old way, landed on the whole list instead.
 * "/residents/34/edit" arrives at "/population/residents/34/edit".
 */
export default function MovedTo({ to }: { to: string }) {
  const rest = useParams()["*"] ?? "";
  const { search, hash } = useLocation();

  return <Navigate to={`${to}${rest ? `/${rest}` : ""}${search}${hash}`} replace />;
}

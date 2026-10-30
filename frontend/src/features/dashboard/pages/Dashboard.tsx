import { useAuth } from "../../../shared/auth/AuthContext";
import MainOfficeDashboard from "../offices/MainOfficeDashboard";
import VawcDashboard from "../offices/VawcDashboard";
import LuponDashboard from "../offices/LuponDashboard";
import PopulationOfficeDashboard from "../offices/PopulationOfficeDashboard";
import HealthStationDashboard from "../offices/HealthStationDashboard";
import AdminDashboard from "../offices/AdminDashboard";

/**
 * Staff landing — every audience gets its own dashboard, per the MIS spec.
 * (Residents never reach this route; they land on /portal.)
 */
export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.office) {
    case "VAWC":
      return <VawcDashboard />;
    case "Lupon":
      return <LuponDashboard />;
    case "Population":
      return <PopulationOfficeDashboard />;
    case "Health Station":
      return <HealthStationDashboard />;
    case "Admin":
      return <AdminDashboard />;
    default:
      // Main Office — Secretary and Punong Barangay share the same executive dashboard.
      return <MainOfficeDashboard executive={user.role === "Punong Barangay" || user.role === "Secretary"} />;
  }
}

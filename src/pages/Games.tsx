import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Games / Blaze Coins removed site-wide (2026-09-08 incident). No nav entry
// point links here any more, so a visit is only via an old bookmark/link —
// send it home rather than rendering any games/coins UI.
const Games = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
};

export default Games;

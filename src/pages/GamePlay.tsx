import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Games / Blaze Coins removed site-wide (2026-09-08 incident). See Games.tsx.
const GamePlay = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
};

export default GamePlay;

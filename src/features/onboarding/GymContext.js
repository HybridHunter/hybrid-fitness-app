import { createContext, useContext, useState } from "react";

const GymCtx = createContext({ gymId: "default" });
export const useGym = () => useContext(GymCtx);

export function GymProvider({ children }) {
  const [gymId, setGymId] = useState(() => {
    return localStorage.getItem("hf_gym_id") || "default";
  });

  const switchGym = (id) => {
    localStorage.setItem("hf_gym_id", id);
    setGymId(id);
  };

  return (
    <GymCtx.Provider value={{ gymId, switchGym }}>
      {children}
    </GymCtx.Provider>
  );
}

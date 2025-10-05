import React, { useEffect, useState } from "react";
import API from "../api/api";

export default function Rides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const fetchRides = async () => {
      const res = await API.get("/rides");
      setRides(res.data);
    };
    fetchRides();
  }, []);

  return (
    <div className="rides-container">
      <h2>Available Rides</h2>
      <ul>
        {rides.map((ride) => (
          <li key={ride.id}>
            <strong>{ride.origin}</strong> → {ride.destination} — GHC {ride.price}
          </li>
        ))}
      </ul>
    </div>
  );
}


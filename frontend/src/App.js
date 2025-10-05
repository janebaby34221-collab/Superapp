import React, { useState } from "react";
import Login from "./components/Login";
import Rides from "./components/Rides";
import "./styles.css";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));

  return (
    <div>
      {loggedIn ? (
        <>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              setLoggedIn(false);
            }}
            className="logout-btn"
          >
            Logout
          </button>
          <Rides />
        </>
      ) : (
        <Login onLogin={() => setLoggedIn(true)} />
      )}
    </div>
  );
}


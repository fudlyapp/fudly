export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontFamily: "Arial"
    }}>
      
      <h1 style={{fontSize: "48px", marginBottom: "20px"}}>
        🍽️ Fudly
      </h1>

      <p style={{fontSize: "20px", marginBottom: "40px"}}>
        AI jedálniček, ktorý šetrí čas aj peniaze
      </p>

      <a
  href="/generate"
  style={{
    padding: "15px 30px",
    fontSize: "18px",
    background: "black",
    color: "white",
    borderRadius: "10px",
    textDecoration: "none",
    display: "inline-block",
  }}
>
  Vygenerovať jedálniček
</a>

    </main>
  );
}

/** Night sky with drifting clouds and twinkling stars; absolutely fills its relative parent. */
export function CloudSky() {
  return (
    <div className="sky" aria-hidden>
      <span className="star s1" />
      <span className="star s2" />
      <span className="star s3" />
      <span className="star s4" />
      <span className="star s5" />
      <span className="star s6" />
      <span className="star s7" />
      <span className="star s8" />
      <span className="cloud c1" />
      <span className="cloud c2" />
      <span className="cloud c3" />
      <span className="cloud c4" />
      <span className="cloud c5" />
    </div>
  );
}

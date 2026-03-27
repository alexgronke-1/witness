"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const P = {
  bg: "#0C0C14",
  surface: "#13131E",
  surface2: "#1A1A28",
  border: "#22223A",
  border2: "#2E2E4A",
  blue: "#0057FF",
  red: "#FF3B30",
  yellow: "#FFD600",
  white: "#F2F0EA",
  dim: "#8888AA",
  muted: "#4A4A66",
};

const gss = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@300;400&family=DM+Serif+Display:ital@0;1&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;background:${P.bg};}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${P.border2};}
`;

function MapSection({ label, color, text }) {
  return (
    <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: 16 }}>
      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.85,
          color: "#C0C0D8",
          fontWeight: 300,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const d = searchParams.get("d");

  let storyMap = null;
  if (d) {
    try {
      storyMap = JSON.parse(atob(decodeURIComponent(d)));
    } catch {
      storyMap = null;
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gss }} />
      <div
        style={{
          minHeight: "100vh",
          background: P.bg,
          fontFamily: "'DM Sans',sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            width: "100%",
            padding: "20px 32px",
            borderBottom: `1px solid ${P.border}`,
            display: "flex",
            alignItems: "center",
          }}
        >
          <img
            src="/pretzl-wordmark.png"
            alt="Pretzl"
            style={{ height: 20, opacity: 0.8 }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            padding: "48px 32px 80px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
          }}
        >
          {!storyMap ? (
            <div
              style={{
                textAlign: "center",
                paddingTop: 80,
                fontFamily: "'DM Mono',monospace",
                fontSize: 13,
                color: P.dim,
                letterSpacing: "0.08em",
              }}
            >
              No story map found.
            </div>
          ) : (
            <>
              <div>
                <div
                  style={{
                    fontFamily: "'DM Serif Display',serif",
                    fontStyle: "italic",
                    fontSize: 32,
                    color: P.white,
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}
                >
                  Story Map
                </div>
              </div>

              {storyMap.subject && (
                <MapSection label="Subject" color={P.muted} text={storyMap.subject} />
              )}

              {storyMap.the_before && (
                <MapSection label="The Before" color={P.red} text={storyMap.the_before} />
              )}

              {storyMap.stakes && (
                <MapSection label="Stakes" color={P.yellow} text={storyMap.stakes} />
              )}

              {storyMap.scenes?.length > 0 && (
                <div style={{ borderLeft: `2px solid ${P.blue}`, paddingLeft: 16 }}>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: P.blue,
                      marginBottom: 16,
                    }}
                  >
                    Scenes
                  </div>
                  {storyMap.scenes.map((sc, i) => (
                    <div key={i} style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 11,
                          color: P.blue,
                          marginBottom: 5,
                        }}
                      >
                        {sc.label}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          lineHeight: 1.85,
                          color: "#C0C0D8",
                          fontWeight: 300,
                        }}
                      >
                        {sc.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {storyMap.witness_moments?.length > 0 && (
                <div style={{ borderLeft: `2px solid ${P.blue}`, paddingLeft: 16 }}>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: P.blue,
                      marginBottom: 16,
                    }}
                  >
                    Witness Moments
                  </div>
                  {storyMap.witness_moments.map((w, i) => (
                    <div key={i} style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontFamily: "'DM Serif Display',serif",
                          fontStyle: "italic",
                          fontSize: 17,
                          lineHeight: 1.7,
                          color: P.white,
                          marginBottom: 8,
                        }}
                      >
                        "{w.quote}"
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: 11,
                          color: "#9A9ABB",
                          lineHeight: 1.65,
                        }}
                      >
                        {w.why}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {storyMap.personal_thread && (
                <MapSection
                  label="Personal Thread"
                  color="#8B6E9E"
                  text={storyMap.personal_thread}
                />
              )}

              {storyMap.best_question_remaining && (
                <div
                  style={{
                    background: `${P.blue}10`,
                    border: `1px solid ${P.blue}22`,
                    padding: 18,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: P.blue,
                      display: "block",
                      marginBottom: 10,
                    }}
                  >
                    Next Best Question
                  </span>
                  <div
                    style={{
                      fontFamily: "'DM Serif Display',serif",
                      fontStyle: "italic",
                      fontSize: 17,
                      color: "#90C8EE",
                      lineHeight: 1.7,
                    }}
                  >
                    {storyMap.best_question_remaining}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#0C0C14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Mono',monospace",
            fontSize: 12,
            color: "#8888AA",
            letterSpacing: "0.1em",
          }}
        >
          Loading…
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}

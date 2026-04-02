from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle
import pandas as pd
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and dataset once at startup
with open("model.pkl", "rb") as f:
    bundle = pickle.load(f)
    model = bundle["model"]
    FEATURES = bundle["features"]

df = pd.read_csv("results.csv")
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").reset_index(drop=True)

# Pre-build team lookup
team_matches = {
    team: df[(df["home_team"] == team) | (df["away_team"] == team)].copy()
    for team in pd.concat([df["home_team"], df["away_team"]]).unique()
}

OUTCOME_MAP = {0: "Home Win", 1: "Draw", 2: "Away Win"}

TIER_MAP = {
    "FIFA World Cup": 3,
    "UEFA Euro": 3,
    "Copa América": 3,
    "AFC Asian Cup": 3,
    "Friendly": 1,
}

def get_team_form(team, n=5):
    past = team_matches.get(team, pd.DataFrame()).tail(n)
    if len(past) == 0:
        return (0.33, 0.0, 0.0)
    wins, scored, conceded = 0, 0, 0
    for _, p in past.iterrows():
        if p["home_team"] == team:
            scored += p["home_score"]
            conceded += p["away_score"]
            wins += p["home_score"] > p["away_score"]
        else:
            scored += p["away_score"]
            conceded += p["home_score"]
            wins += p["away_score"] > p["home_score"]
    return (wins / len(past), scored / len(past), conceded / len(past))


class MatchRequest(BaseModel):
    home_team: str
    away_team: str
    is_neutral: bool = False
    tournament: str = "Friendly"


@app.get("/teams")
def get_teams():
    teams = sorted(pd.concat([df["home_team"], df["away_team"]]).unique().tolist())
    return {"teams": teams}


@app.post("/predict")
def predict(req: MatchRequest):
    h = get_team_form(req.home_team)
    a = get_team_form(req.away_team)

    tier = next((v for k, v in TIER_MAP.items() if k in req.tournament), 2)

    features = np.array([[
        h[0], h[1], h[2],
        a[0], a[1], a[2],
        int(req.is_neutral),
        tier
    ]])

    pred = model.predict(features)[0]
    proba = model.predict_proba(features)[0]

    return {
        "result": OUTCOME_MAP[pred],
        "confidence": round(float(proba[pred]) * 100, 1),
        "probabilities": {
            "Home Win": round(float(proba[0]) * 100, 1),
            "Draw": round(float(proba[1]) * 100, 1),
            "Away Win": round(float(proba[2]) * 100, 1),
        },
        "home_form": {
            "win_rate": round(h[0] * 100, 1),
            "avg_scored": round(h[1], 2),
            "avg_conceded": round(h[2], 2),
        },
        "away_form": {
            "win_rate": round(a[0] * 100, 1),
            "avg_scored": round(a[1], 2),
            "avg_conceded": round(a[2], 2),
        }
    }
# Convert CSV from Spotify List to JSON for the Deezer API

import pandas as pd
import json
import re
import sys
import os

def clean_track_name(name):
    name = re.sub(r'\s*\[.*?\]', '', name)
    name = re.sub(r'\s*\(.*?\)', '', name)
    name = re.sub(r'\s*-\s*.*$', '', name)
    return name.strip()

def convert_csv_to_clean_json(csv_path):
    if not os.path.isfile(csv_path):
        print(f"Error: File '{csv_path}' not found.")
        return

    df = pd.read_csv(csv_path)

    required_columns = {"Track Name", "Artist Name(s)"}
    if not required_columns.issubset(df.columns):
        print("Error: CSV must contain 'Track Name' and 'Artist Name(s)' columns.")
        return

    df = df[["Track Name", "Artist Name(s)"]]
    df["Track Name"] = df["Track Name"].apply(clean_track_name)

    json_data = df.to_dict(orient="records")

    base_dir = os.path.dirname(csv_path)
    output_path = os.path.join(base_dir, "hummify-list-cleaned.json")

    with open(output_path, "w") as f:
        json.dump(json_data, f, indent=2)

    print(f"Cleaned JSON saved to: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Input CSV File: python convert_tracks.py path/to/your/file.csv")
    else:
        convert_csv_to_clean_json(sys.argv[1])

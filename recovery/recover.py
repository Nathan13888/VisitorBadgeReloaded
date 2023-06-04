import requests

import json

# Open JSON file
with open('rec.json') as file:
    # Load JSON data
    data = json.load(file)

    # Iterate through fields
    for key, value in data.items():
        url = f"https://vbr.wocr.tk/rec?page_id={key}&count={value}"
        response = requests.get(url)
        if response.status_code == 200:
            #print('Request successful')
            print('Response content:', response.text)
        else:
            print('Request error:', response.status_code)


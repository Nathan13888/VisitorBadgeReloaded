# asdflkasjdfklajsdkf page=Nezhinskiy views=186
from collections import defaultdict
import json
import re


hashes = defaultdict(lambda:0)

def can_cast_to_integer(string):
    try:
        int(string)
        return True
    except ValueError:
        return False

def process(line):
    sss = line.split()
    hsh = ""
    vws = ""
    for s in sss:
        if s.startswith("page="):
            hsh = s[5:]
        elif s.startswith("views="):
            vws = s[6:]
    vws = re.sub(r'\D', '', vws)
    if len(hsh) == 0 or len(vws)==0:
        return
    if not can_cast_to_integer(vws):
        ##print(f"Skipping view count '{vws}'")
        return
    res = hashes[hsh]
    if res is not None:
        if int(res) < int(vws):
            hashes[hsh]=vws
            ##print(f"Updated hash '{hsh}' with '{vws}'")
        #else:
            ##print(f"Update SKIPPED for '{hsh}'")

    
with open("filtered.dump", "r") as file:
    for line in file:
        #print(line.strip())
        process(line.strip())


json_data = json.dumps(hashes, indent=4)

print(json_data)


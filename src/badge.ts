const SHIELDS_URL = "https://img.shields.io";

export type BadgeOptions = {
  label: string;
  text: string;
  colour: string;
  labelColour: string;
  style: string;
  logo: string;
  logoColour: string;
};

export const createBadge = async (
  opt: BadgeOptions,
): Promise<string | null> => {
  const qry = `${SHIELDS_URL}/badge/${opt.label}-${opt.text}-${opt.colour}?labelColor=${opt.labelColour}&style=${opt.style}&logo=${opt.logo}&logoColor=${opt.logoColour}`;

  // query GET request
  const req = new Request(qry, {
    method: "GET",
    headers: {
      Accept: "image/svg+xml",
      "Content-Type": "image/svg+xml",
    },
  });

  const res = await fetch(req);
  if (!res.ok) {
    console.error(`Failed to fetch badge: ${res.status} ${res.statusText}`);
    return null;
  }

  // return response body
  const svg = await res.text();
  return svg;
};

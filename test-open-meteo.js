async function test() {
  const lats = "51.529775,51.483765,52.45505,53.456641,53.817544,52.937172,54.846543,50.924464,51.488523,51.018985,51.477028,51.732003,50.831006,51.267497,52.244018,52.189993,52.610015,52.925011";
  const lngs = "-0.172186,-0.114889,-1.902644,-2.286847,-1.580665,-1.132536,-1.564539,-1.322143,-3.190538,-3.100057,-2.585031,0.468019,-0.165034,1.092042,-0.875026,-2.228045,-1.140032,-1.455029";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,is_day,visibility,uv_index,shortwave_radiation&timezone=auto&wind_speed_unit=mph`;
  const res = await fetch(url);
  console.log(res.status);
  const data = await res.json();
  console.log(data.length);
}

test();

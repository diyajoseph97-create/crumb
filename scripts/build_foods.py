"""Build data/foods.json: per-100 g nutrition for common home-cooking ingredients.

Sources (both free to use):
- IFCT 2017, Indian Food Composition Tables, National Institute of Nutrition (npm @ifct2017/compositions, MIT)
- USDA National Nutrient Database for Standard Reference (github.com/hadley/usdanutrients), public domain
Each entry: name, other names, per-100 g [kcal, protein, fat, carbs (total, incl. fibre), fibre],
and grams for household measures (cup, tbsp, tsp, piece, ...), from USDA's weights table.
Run: python3 -I scripts/build_foods.py <ifct csv> <usdanutrients/data>
"""
import csv, json, sys, re
import pyreadr

IFCT_CSV, USDA_DIR = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(IFCT_CSV)))
K = list(rows[0].keys())
col = lambda n: [c for c in K if c.endswith("; " + n)][0]
ifct = {r[col("code")]: r for r in rows}
def fnum(x):
    try: return float(x)
    except: return 0.0
def from_ifct(code):
    r = ifct[code]
    p, f, c, fib = (fnum(r[col(x)]) for x in ("protcnt", "fatce", "choavldf", "fibtg"))
    kj = fnum(r[col("enerc")])
    kcal = kj / 4.184 if kj > 0 else 4 * p + 9 * f + 4 * c + 2 * fib
    return [kcal, p, f, c + fib, fib], f"IFCT 2017 {code} {r[col('name')]}"

R = lambda n: list(pyreadr.read_r(f"{USDA_DIR}/{n}.rda").values())[0]
food, nut, wt = R("food"), R("nutrient"), R("weight")
nut = nut[nut.nutr_id.isin([208, 203, 204, 205, 291])]
NUT = {}
for fid, nid, v in zip(nut.food_id, nut.nutr_id, nut.value): NUT.setdefault(int(fid), {})[int(nid)] = float(v)
DESC = dict(zip(food.food_id.astype(int), food.food))
WEIGHTS = {}
for fid, amt, desc, g in zip(wt.food_id, wt.amount, wt.desc, wt.weight):
    if amt and g: WEIGHTS.setdefault(int(fid), []).append((str(desc).lower(), float(g) / float(amt)))

MISSES = []
def usda_find(q):
    words = q.lower().split()
    hits = [(len(d), fid, d) for fid, d in DESC.items() if all(w in d.lower() for w in words)]
    if not hits:
        MISSES.append(q)
        return None
    return sorted(hits)[0][1]
def from_usda(fid):
    n = NUT[fid]
    return [n.get(208, 0), n.get(203, 0), n.get(204, 0), n.get(205, 0), n.get(291, 0)], f"USDA SR {fid} {DESC[fid]}"

def measures(fid):
    out = {}
    for desc, g in WEIGHTS.get(fid, []):
        d = re.sub(r"[,(].*", "", desc).strip()
        for key, pat in [("cup", r"^cup"), ("tbsp", r"^tbsp"), ("tsp", r"^tsp"), ("clove", r"^clove"), ("bunch", r"^bunch"), ("slice", r"^slice"),
                         ("piece", r"^(medium|each|piece|whole|fruit|egg|item)"), ("small", r"^small"), ("large", r"^large|^extra large"), ("inch", r"^1\" ?|^inch"), ("can", r"^can")]:
            if re.search(pat, d) and key not in out: out[key] = round(g, 1)
    return out

# name | other names | source (I:code or U:usda words) | measures twin (USDA words, for IFCT items) | extra grams
F = [
 # grains & flours
 ("rice", "basmati rice|chawal|jeera rice|sona masoori", "I:A015", "rice white long-grain regular raw", {}),
 ("brown rice", "", "I:A013", "rice brown long-grain raw", {}),
 ("cooked rice", "boiled rice|steamed rice|leftover rice|cooked basmati rice", "U:rice white long-grain regular enriched cooked", "", {}),
 ("cooked brown rice", "", "U:rice brown long-grain cooked", "", {}),
 ("cooked pasta", "boiled pasta|cooked spaghetti|cooked noodles", "U:spaghetti cooked enriched without added salt", "", {}),
 ("cooked quinoa", "", "U:quinoa cooked", "", {}),
 ("poha", "rice flakes|flattened rice|aval", "I:A011", "", {"cup": 50}),
 ("puffed rice", "murmura|kurmura", "I:A012", "", {"cup": 14}),
 ("whole wheat flour", "atta|chapati flour", "I:A019", "wheat flour whole-grain", {}),
 ("all-purpose flour", "maida|plain flour", "I:A018", "wheat flour white all-purpose enriched bleached", {}),
 ("semolina", "rava|sooji|suji", "I:A022", "semolina enriched", {}),
 ("vermicelli", "seviyan|semiya", "I:A023", "", {"cup": 50}),
 ("gram flour", "besan|chickpea flour", "U:chickpea flour besan", "", {}),
 ("rice flour", "", "U:rice flour white", "", {}),
 ("cornflour", "cornstarch|corn flour|corn starch", "U:cornstarch", "", {}),
 ("oats", "rolled oats|oatmeal", "U:oats", "", {}),
 ("quinoa", "", "I:A009", "quinoa uncooked", {}),
 ("ragi flour", "ragi|finger millet", "I:A010", "", {"cup": 120}),
 ("jowar flour", "jowar|sorghum", "I:A005", "", {"cup": 120}),
 ("bajra flour", "bajra|pearl millet", "I:A003", "", {"cup": 120}),
 ("bread", "white bread|sandwich bread|pav", "U:bread white commercially prepared (includes soft bread crumbs)", "", {}),
 ("brown bread", "whole wheat bread", "U:bread whole-wheat commercially prepared", "", {}),
 ("baguette", "french bread", "U:bread french or vienna", "", {}),
 ("pasta", "penne|macaroni|fusilli|farfalle|rigatoni", "U:macaroni dry enriched", "", {"cup": 100}),
 ("spaghetti", "linguine|fettuccine|noodles", "U:spaghetti dry enriched", "", {"cup": 100}),
 ("tortilla", "wrap|roti wrap", "U:tortillas ready-to-bake wheat", "", {"piece": 45}),
 ("puff pastry", "", "U:puff pastry frozen ready-to-bake", "", {"sheet": 245}),
 # pulses
 ("pigeon peas", "toor dal|arhar dal|tur dal|toovar dal", "I:B021", "lentils raw", {}),
 ("chana dal", "split bengal gram", "I:B001", "lentils raw", {}),
 ("moong dal", "green gram dal|yellow moong", "I:B010", "lentils raw", {}),
 ("whole moong", "green gram|mung beans|sabut moong", "I:B011", "mung beans mature seeds raw", {}),
 ("masoor dal", "red lentils|lentils", "I:B013", "lentils raw", {}),
 ("urad dal", "black gram dal", "I:B003", "lentils raw", {}),
 ("chickpeas", "kabuli chana|chole|garbanzo", "U:chickpeas mature seeds canned", "", {}),
 ("dry chickpeas", "", "U:chickpeas mature seeds raw", "", {}),
 ("kidney beans", "rajma", "U:kidney red mature seeds canned", "", {}),
 ("black chickpeas", "kala chana", "I:B002", "chickpeas mature seeds raw", {}),
 ("soya chunks", "soy chunks|nutrela", "U:soy flour defatted", "", {"cup": 50}),
 ("tofu", "", "U:tofu firm prepared with calcium sulfate", "", {}),
 # vegetables
 ("onion", "pyaz|red onion|white onion|shallot", "I:G017", "onions raw", {"piece": 110}),
 ("tomato", "tamatar|cherry tomatoes", "I:D076", "tomatoes red ripe raw year round average", {"piece": 123}),
 ("potato", "aloo", "I:F006", "potatoes flesh and skin raw", {"piece": 173}),
 ("sweet potato", "shakarkandi", "I:F013", "sweet potato raw unprepared", {}),
 ("spinach", "palak|baby spinach", "I:C033", "spinach raw", {"bunch": 340}),
 ("fenugreek leaves", "methi|methi leaves", "I:C020", "", {"cup": 30, "bunch": 100}),
 ("kasuri methi", "dried fenugreek leaves", "U:spices fenugreek seed", "", {"tbsp": 1.5, "tsp": 0.5}),
 ("cauliflower", "gobi|phool gobi", "I:D036", "cauliflower raw", {}),
 ("cabbage", "patta gobi", "I:C015", "cabbage raw", {}),
 ("carrot", "gajar|carrots", "I:F002", "carrots raw", {}),
 ("peas", "green peas|matar|frozen peas", "I:D061", "peas green raw", {}),
 ("bell pepper", "capsicum|shimla mirch", "I:D033", "peppers sweet green raw", {}),
 ("cucumber", "kheera", "I:D043", "cucumber with peel raw", {}),
 ("eggplant", "brinjal|baingan|aubergine", "I:D031", "eggplant raw", {}),
 ("okra", "bhindi|ladies finger", "I:D056", "okra raw", {}),
 ("green beans", "french beans|beans", "I:D050", "beans snap green raw", {}),
 ("bottle gourd", "lauki|doodhi", "I:D007", "gourd white-flowered calabash raw", {}),
 ("pumpkin", "kaddu", "I:D066", "pumpkin raw", {}),
 ("zucchini", "courgette", "I:D077", "squash summer zucchini includes skin raw", {}),
 ("mushroom", "button mushrooms|mushrooms", "U:mushrooms white raw", "", {}),
 ("corn", "sweet corn|corn kernels|bhutta", "U:corn sweet yellow raw", "", {}),
 ("beetroot", "beet", "I:F001", "beets raw", {}),
 ("radish", "mooli", "I:F010", "radishes raw", {}),
 ("lettuce", "", "U:lettuce green leaf raw", "", {}),
 ("broccoli", "", "U:broccoli raw", "", {}),
 ("spring onion", "scallion|green onion", "I:D058", "onions spring or scallions raw", {}),
 ("garlic", "lahsun|ginger-garlic paste|ginger garlic paste|garlic paste", "I:G011", "garlic raw", {"clove": 3, "piece": 3}),
 ("ginger", "adrak", "I:G014", "ginger root raw", {"inch": 6}),
 ("green chilli", "hari mirch|green chillies|chilli", "I:G008", "peppers hot chili green raw", {"piece": 4}),
 ("coriander", "dhania|cilantro|coriander leaves", "I:G009", "coriander cilantro leaves raw", {"bunch": 50, "handful": 10}),
 ("mint", "pudina|mint leaves", "I:G016", "spearmint fresh", {"bunch": 30, "handful": 8}),
 ("curry leaves", "kadi patta", "I:G010", "", {"sprig": 1, "cup": 10, "tbsp": 1, "handful": 5}),
 ("lemon", "lemon juice|nimbu", "U:lemon juice raw", "", {"piece": 47}),
 ("lime", "lime juice", "U:lime juice raw", "", {"piece": 30}),
 ("raw mango", "kairi", "I:D057", "", {"piece": 200}),
 # fruit
 ("banana", "bananas|kela", "U:bananas raw", "", {}),
 ("mango", "mango pulp|aam", "U:mangos raw", "", {}),
 ("apple", "", "U:apples raw with skin", "", {}),
 ("strawberries", "strawberry", "U:strawberries raw", "", {}),
 ("blueberries", "", "U:blueberries raw", "", {}),
 ("dates", "khajur", "U:dates medjool", "", {"piece": 24}),
 ("raisins", "kishmish", "U:raisins seedless", "", {}),
 ("avocado", "", "U:avocados raw all commercial varieties", "", {}),
 # dairy & eggs
 ("paneer", "cottage cheese", "I:L003", "", {"cup": 120, "piece": 25}),
 ("milk", "full cream milk|whole milk|doodh", "U:milk whole 3.25% milkfat", "", {}),
 ("yogurt", "curd|dahi|yoghurt|hung curd", "U:yogurt plain whole milk", "", {}),
 ("greek yogurt", "", "U:yogurt greek plain", "", {"cup": 245}),
 ("cream", "fresh cream|heavy cream|malai|cooking cream", "U:cream fluid heavy whipping", "", {}),
 ("butter", "makhan|unsalted butter|salted butter", "U:butter salted", "", {"cube": 10}),
 ("ghee", "clarified butter", "I:T013", "butter oil anhydrous", {}),
 ("cheese", "cheddar|processed cheese|cheese slice", "U:cheese cheddar", "", {"slice": 20}),
 ("mozzarella", "pizza cheese", "U:cheese mozzarella whole milk", "", {}),
 ("parmesan", "parmigiano reggiano", "U:cheese parmesan grated", "", {}),
 ("cream cheese", "", "U:cheese cream", "", {}),
 ("feta", "feta cheese", "U:cheese feta", "", {}),
 ("condensed milk", "milkmaid", "U:milk canned condensed sweetened", "", {}),
 ("khoa", "mawa", "I:L004", "", {"cup": 130}),
 ("egg", "eggs|anda", "I:M001", "egg whole raw fresh", {"piece": 50}),
 ("egg white", "", "I:M002", "egg white raw fresh", {"piece": 33}),
 # meat & fish
 ("chicken", "chicken breast|chicken thighs|boneless chicken", "I:N003", "", {"piece": 120, "cup": 140}),
 ("chicken thigh", "chicken thighs|thighs", "I:N002", "", {"piece": 110, "cup": 140}),
 ("mutton", "goat|lamb", "I:O001", "", {"cup": 140}),
 ("minced meat", "keema|ground beef|mince", "U:beef ground 80% lean meat 20% fat raw", "", {"cup": 225}),
 ("fish", "fish fillet|basa|tilapia", "I:P083", "", {"piece": 120}),
 ("salmon", "", "I:P068", "", {"piece": 150}),
 ("prawns", "shrimp|jhinga", "I:S009", "crustaceans shrimp mixed species raw", {}),
 ("bacon", "", "U:pork cured bacon unprepared", "", {"slice": 28}),
 ("tuna", "canned tuna", "U:fish tuna light canned in water drained", "", {}),
 # nuts & seeds
 ("cashews", "kaju|cashew", "I:H005", "", {"cup": 137, "tbsp": 8.6, "piece": 1.5, "handful": 28}),
 ("almonds", "badam|almond", "I:H001", "nuts almonds", {}),
 ("peanuts", "groundnut|moongphali|peanut", "I:H012", "peanuts all types raw", {}),
 ("walnuts", "akhrot|walnut", "I:H021", "nuts walnuts english", {}),
 ("pistachios", "pista", "I:H018", "nuts pistachio nuts raw", {}),
 ("coconut", "grated coconut|fresh coconut|nariyal", "I:H007", "nuts coconut meat raw", {}),
 ("desiccated coconut", "dry coconut|copra", "I:H006", "", {"cup": 93}),
 ("sesame seeds", "til|gingelly", "I:H011", "seeds sesame seeds whole dried", {}),
 ("peanut butter", "", "U:peanut butter smooth style without salt", "", {}),
 ("chia seeds", "", "U:seeds chia seeds dried", "", {"tbsp": 12}),
 ("flax seeds", "flaxseed|alsi", "I:H014", "seeds flaxseed", {}),
 # oils & fats
 ("oil", "vegetable oil|cooking oil|sunflower oil|refined oil", "I:T012", "oil sunflower linoleic", {}),
 ("mustard oil", "sarson oil", "I:T006", "oil mustard", {}),
 ("coconut oil", "", "I:T001", "oil coconut", {}),
 ("olive oil", "extra virgin olive oil", "U:oil olive salad or cooking", "", {}),
 ("sesame oil", "gingelly oil|til oil", "I:T004", "oil sesame salad or cooking", {}),
 ("groundnut oil", "peanut oil", "I:T005", "oil peanut salad or cooking", {}),
 # sweet
 ("sugar", "white sugar|caster sugar|granulated sugar|chini", "U:sugars granulated", "", {}),
 ("brown sugar", "", "U:sugars brown", "", {}),
 ("powdered sugar", "icing sugar|confectioners sugar", "U:sugars powdered", "", {}),
 ("jaggery", "gur|gud", "I:I001", "sugars brown", {}),
 ("honey", "", "U:honey", "", {}),
 ("maple syrup", "", "U:syrups maple", "", {}),
 ("cocoa powder", "cocoa", "U:cocoa dry powder unsweetened", "", {}),
 ("chocolate", "dark chocolate|chocolate chips|semi-sweet chocolate", "U:chocolate dark 60-69% cacao solids", "", {"cup": 170, "piece": 7}),
 ("vanilla extract", "vanilla essence|vanilla", "U:vanilla extract", "", {}),
 ("baking powder", "", "U:leavening agents baking powder double-acting", "", {}),
 ("baking soda", "soda bicarbonate|cooking soda", "U:leavening agents baking soda", "", {}),
 ("yeast", "dry yeast|instant yeast", "U:leavening agents yeast baker's active dry", "", {}),
 ("jam", "strawberry jam|any flavor jam|preserves", "U:jams and preserves", "", {}),
 # sauces & condiments
 ("soy sauce", "light soy sauce|dark soy sauce", "U:soy sauce made from soy and wheat (shoyu)", "", {}),
 ("tomato ketchup", "ketchup", "U:catsup", "", {}),
 ("tomato paste", "tomato puree", "U:tomato products canned paste without salt", "", {}),
 ("crushed tomatoes", "canned tomatoes|chopped tomatoes|tomato sauce", "U:tomatoes crushed canned", "", {"can": 400}),
 ("vinegar", "white vinegar|rice vinegar|apple cider vinegar", "U:vinegar distilled", "", {}),
 ("mayonnaise", "mayo", "U:salad dressing mayonnaise regular", "", {}),
 ("mustard", "dijon mustard", "U:mustard prepared yellow", "", {}),
 ("coconut milk", "", "U:nuts coconut milk canned", "", {"can": 400}),
 ("chilli sauce", "chilli garlic sauce|sriracha|hot sauce|red chilli sauce", "U:sauce chili peppers hot immature green canned", "", {}),
 ("tamarind", "imli|tamarind paste|tamarind pulp", "U:tamarinds raw", "", {}),
 ("salt", "namak|sea salt|black salt|kala namak", "U:salt table", "", {}),
 ("water", "hot water|warm water|cold water|ice", "U:water tap drinking", "", {}),
 ("stock", "broth|vegetable stock|chicken stock", "U:soup stock chicken home-prepared", "", {}),
 # spices
 ("chilli powder", "red chilli powder|kashmiri chilli powder|lal mirch", "U:spices chili powder", "", {}),
 ("turmeric", "haldi|turmeric powder", "I:G033", "spices turmeric ground", {}),
 ("coriander powder", "dhania powder|ground coriander", "U:spices coriander seed", "", {}),
 ("cumin seeds", "jeera|cumin|cumin powder|jeera powder", "I:G025", "spices cumin seed", {}),
 ("garam masala", "biryani masala|curry powder|masala|pav bhaji masala|chole masala|kitchen king", "U:spices curry powder", "", {"packet": 50}),
 ("black pepper", "pepper|kali mirch", "I:G031", "spices pepper black", {}),
 ("mustard seeds", "rai|sarson", "I:H013", "spices mustard seed ground", {}),
 ("fenugreek seeds", "methi seeds|methi dana", "I:G026", "spices fenugreek seed", {}),
 ("cardamom", "elaichi|green cardamom", "I:G020", "spices cardamom", {"piece": 0.2}),
 ("cloves", "laung", "I:G023", "spices cloves ground", {"piece": 0.1}),
 ("cinnamon", "dalchini|cinnamon stick", "U:spices cinnamon ground", "", {"piece": 2, "stick": 2}),
 ("bay leaf", "tej patta|bay leaves", "U:spices bay leaf", "", {"piece": 0.2}),
 ("asafoetida", "hing", "I:G019", "", {"tsp": 1, "pinch": 0.2}),
 ("dried red chilli", "red chillies|sukhi lal mirch|whole red chilli", "I:G022", "", {"piece": 0.5}),
 ("oregano", "dried oregano|italian seasoning|mixed herbs", "U:spices oregano dried", "", {}),
 ("paprika", "smoked paprika", "U:spices paprika", "", {}),
 ("chilli flakes", "red pepper flakes|chili flakes", "U:spices pepper red or cayenne", "", {}),
 ("basil", "fresh basil", "U:basil fresh", "", {"handful": 5}),
 ("parsley", "", "I:C028", "parsley fresh", {"handful": 8}),
]

# Check every search first and list the ones that found nothing, with near matches.
for name, aka, src, twin, extra in F:
    if src.startswith("U:"): usda_find(src[2:])
    if twin: usda_find(twin)
if MISSES:
    for q in MISSES:
        w = q.lower().split()
        near = sorted({d for d in DESC.values() if sum(x in d.lower() for x in w) >= max(1, len(w) - 1)}, key=len)[:4]
        print("MISS", q, "->", near)
    raise SystemExit(1)
out = []
for name, aka, src, twin, extra in F:
    if src.startswith("I:"):
        v, source = from_ifct(src[2:])
        m = measures(usda_find(twin)) if twin else {}
    else:
        fid = usda_find(src[2:]); v, source = from_usda(fid); m = measures(fid)
    m.update(extra)
    if "cup" in m: m.setdefault("tbsp", round(m["cup"] / 16, 1)); m.setdefault("tsp", round(m["cup"] / 48, 2))
    if "tbsp" in m: m.setdefault("tsp", round(m["tbsp"] / 3, 2))
    out.append({"n": name, "a": [a for a in aka.split("|") if a], "v": [round(x, 1) for x in v], "g": m, "s": source})
json.dump(out, open("data/foods.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "foods")
for o in out: print(f"{o['n'][:16]:16} {str(o['v']):34} {o['s'][:58]:58} {o['g']}")

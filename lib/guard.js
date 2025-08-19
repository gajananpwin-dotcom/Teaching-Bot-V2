export const BAD_WORDS = [
  "fuck","shit","bitch","bastard","asshole","dick","cunt","slut","rape","porn","nude"
];

export function containsBadLanguage(text = "") {
  text = text.toLowerCase();
  return BAD_WORDS.some((w) => text.includes(w));
}

export function extractKeywords(syllabus = "", maxKeywords = 80) {
  const stopWords = new Set(
    ("a,an,the,of,and,or,to,in,on,for,by,with,from,as,at,is,are,was,were," +
     "be,been,that,this,these,those,which,who,whom,whose,into,than,then,it," +
     "its,not,do,does,did,can,could,should,would,may,might,will,shall,has," +
     "have,had,over,under,between,within,about,across,into,out,if,else,when," +
     "while,also,more,most,less,least,very,so,such,per,each,via,using,including," +
     "eg,ie,vs").split(",")
  );

  const freq = new Map();
  syllabus
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !stopWords.has(w))
    .forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([w]) => w);
}

export function isOnSubject(message = "", keywords = []) {
  const messageWords = new Set(
    message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
  );
  const keywordSet = new Set(keywords);

  let matches = 0;
  for (const w of messageWords) {
    if (keywordSet.has(w)) matches++;
  }

  const jaccard = matches / (messageWords.size + keywordSet.size - matches || 1);
  return jaccard >= 0.02 || matches >= 3;
}

export function languageHeader(language = "en") {
  if (language === "hi") return "भाषा: हिंदी (साफ़ और विनम्र)";
  if (language === "mixed") return "Language: Hinglish (clear and polite; English + Hindi mixed)";
  return "Language: English (clear and polite)";
}

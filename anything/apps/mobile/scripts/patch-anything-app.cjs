const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const packageRoot = path.join(rootDir, "node_modules", "@anythingai", "app");

function replaceOnce(contents, search, replacement) {
  const next = contents.replace(search, replacement);
  return next === contents ? null : next;
}

function patchFile(relativePath, edits) {
  const filePath = path.join(packageRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    console.log(`[patch-anything-app] Skipping missing file: ${relativePath}`);
    return;
  }

  let contents = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const { search, replacement } of edits) {
    const next = replaceOnce(contents, search, replacement);
    if (next != null) {
      contents = next;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, contents);
    console.log(`[patch-anything-app] Patched ${relativePath}`);
  } else {
    console.log(`[patch-anything-app] No changes needed for ${relativePath}`);
  }
}

patchFile("build/chunk-TDJ7LH2O.js", [
  {
    search: /,expoSpeechRecognition=require\('expo-speech-recognition'\)/g,
    replacement: "",
  },
  {
    search:
      /var m=zustand\.create\(o=>\(\{hasSpeechPermission:null,setHasSpeechPermission:e=>\{o\(\{hasSpeechPermission:e\}\);\},init:async\(\)=>\{let e=await expoSpeechRecognition\.ExpoSpeechRecognitionModule\.getPermissionsAsync\(\);o\(\{hasSpeechPermission:e\.status==="granted"\|\|e\.status==="undetermined"\}\);\}\}\)\);/,
    replacement:
      "var m=zustand.create(o=>({hasSpeechPermission:false,setHasSpeechPermission:e=>{o({hasSpeechPermission:e});},init:async()=>{o({hasSpeechPermission:false});}}));",
  },
]);

patchFile("build/chunk-TRJRJUEP.mjs", [
  {
    search: /import \{ExpoSpeechRecognitionModule\}from'expo-speech-recognition';/g,
    replacement: "",
  },
  {
    search:
      /var m=create\(o=>\(\{hasSpeechPermission:null,setHasSpeechPermission:e=>\{o\(\{hasSpeechPermission:e\}\);\},init:async\(\)=>\{let e=await ExpoSpeechRecognitionModule\.getPermissionsAsync\(\);o\(\{hasSpeechPermission:e\.status==="granted"\|\|e\.status==="undetermined"\}\);\}\}\)\);/,
    replacement:
      "var m=create(o=>({hasSpeechPermission:false,setHasSpeechPermission:e=>{o({hasSpeechPermission:e});},init:async()=>{o({hasSpeechPermission:false});}}));",
  },
]);

patchFile("build/screens/launcher-menu/index.js", [
  {
    search: /,expoSpeechRecognition=require\('expo-speech-recognition'\)/g,
    replacement: "",
  },
  {
    search:
      /\[g,R\]=react\.useState\(null\),\[d,w\]=react\.useState\(false\);react\.useEffect\(\(\)=>\{expoSpeechRecognition\.ExpoSpeechRecognitionModule\.getPermissionsAsync\(\)\.then\(n=>\{R\(n\.status==="granted"\|\|n\.status==="undetermined"\);\}\);\},\[\]\);/,
    replacement: "g=false,[d,w]=react.useState(false);",
  },
  {
    search: /return a\$5\.isLoading\|\|g===null\|\|!E\?null:/g,
    replacement: "return a$5.isLoading||!E?null:",
  },
]);

patchFile("build/screens/launcher-menu/index.mjs", [
  {
    search: /import \{ExpoSpeechRecognitionModule\}from'expo-speech-recognition';/g,
    replacement: "",
  },
  {
    search:
      /\[g,R\]=useState\(null\),\[d\$2,w\$1\]=useState\(false\);useEffect\(\(\)=>\{ExpoSpeechRecognitionModule\.getPermissionsAsync\(\)\.then\(n=>\{R\(n\.status==="granted"\|\|n\.status==="undetermined"\);\}\);\},\[\]\);/,
    replacement: "g=false,[d$2,w$1]=useState(false);",
  },
  {
    search: /return a\$5\.isLoading\|\|g===null\|\|!E\?null:/g,
    replacement: "return a$5.isLoading||!E?null:",
  },
]);

patchFile("package.json", [
  {
    search: /"expo-speech-recognition": "3\.0\.1",\n/g,
    replacement: "",
  },
]);

import { taggingService } from "../container.js";
import { formatTagging } from "../utils/format.js";

const args = process.argv.slice(2);
const asJson = args[0] === "--json";
const sentence = (asJson ? args.slice(1) : args).join(" ").trim();

if (!sentence) {
  console.error('Usage: npm run tag -- "I am a person"');
  process.exit(1);
}

const result = taggingService.tag(sentence);

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(formatTagging(result));
}

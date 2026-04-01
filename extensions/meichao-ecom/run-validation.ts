import { TaobaoValidator, ValidationReport } from "./src/validation/index.js";

async function main() {
  const validator = new TaobaoValidator();

  console.log("Starting Taobao platform validation...\n");
  console.log("This will collect real data from Taobao adapter.\n");

  const startTime = Date.now();

  try {
    const result = await validator.validate({
      count: 10,
      maskSensitive: false,
    });

    const report = ValidationReport.fromResult(result);
    console.log(report.toText(false));

    console.log("\n--- JSON Output ---\n");
    console.log(report.toJSON(false));
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);

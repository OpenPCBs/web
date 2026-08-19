import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getStoreConfiguration } from "@/app/admin-settings";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { storeSettings } from "@/db/schema";
import {
  ApiError,
  adminBoolean,
  adminError,
  adminInteger,
  adminString,
  auditAdminAction,
} from "../../_lib/admin-api";

const ISO_ALPHA_2 = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" "),
);

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    return Response.json({ store: serializeStore(await getStoreConfiguration()) });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdminRequest(request, "admin");
    const body = await readJsonObject(request);
    const storeName = adminString(
      body.storeName ?? body.name,
      "storeName",
      120,
    );
    const supportEmail = adminString(body.supportEmail, "supportEmail", 254);
    if (supportEmail !== undefined && supportEmail && !validEmail(supportEmail)) {
      throw new ApiError(400, "invalid_field", "supportEmail is invalid.");
    }
    const currencyValue = adminString(body.currency, "currency", 3);
    const currency = currencyValue?.toLowerCase();
    if (currency && !/^[a-z]{3}$/.test(currency)) {
      throw new ApiError(400, "invalid_field", "currency must be a three-letter code.");
    }
    const publicOrigin = originUpdate(body);
    const checkoutEnabled = adminBoolean(body.checkoutEnabled, "checkoutEnabled");
    const flatShippingCents = adminInteger(
      body.flatShippingCents,
      "flatShippingCents",
      0,
      10_000_000,
    );
    const automaticTaxEnabled = adminBoolean(
      body.automaticTaxEnabled,
      "automaticTaxEnabled",
    );
    const allowedShippingCountries = shippingCountriesUpdate(body);
    if (
      storeName === undefined &&
      supportEmail === undefined &&
      currency === undefined &&
      publicOrigin === undefined &&
      checkoutEnabled === undefined &&
      flatShippingCents === undefined &&
      automaticTaxEnabled === undefined &&
      allowedShippingCountries === undefined
    ) {
      throw new ApiError(400, "empty_update", "No store settings were provided.");
    }

    const db = getDb();
    const before = await getStoreConfiguration(db);
    const now = new Date().toISOString();
    const values = {
      ...(storeName === undefined ? {} : { storeName }),
      ...(supportEmail === undefined ? {} : { supportEmail }),
      ...(currency === undefined ? {} : { currency }),
      ...(publicOrigin === undefined ? {} : { publicOrigin }),
      ...(checkoutEnabled === undefined ? {} : { checkoutEnabled }),
      ...(flatShippingCents === undefined ? {} : { flatShippingCents }),
      ...(automaticTaxEnabled === undefined ? {} : { automaticTaxEnabled }),
      ...(allowedShippingCountries === undefined
        ? {}
        : { allowedShippingCountriesJson: JSON.stringify(allowedShippingCountries) }),
      updatedByUserId: actor.userId,
      updatedAt: now,
    };
    await db
      .insert(storeSettings)
      .values({
        id: "store",
        storeName: storeName ?? before.storeName,
        supportEmail: supportEmail ?? before.supportEmail,
        currency: currency ?? before.currency,
        publicOrigin:
          publicOrigin === undefined ? before.publicOrigin : publicOrigin,
        allowedShippingCountriesJson:
          allowedShippingCountries === undefined
            ? before.allowedShippingCountriesJson
            : JSON.stringify(allowedShippingCountries),
        flatShippingCents: flatShippingCents ?? before.flatShippingCents,
        automaticTaxEnabled:
          automaticTaxEnabled ?? before.automaticTaxEnabled,
        checkoutEnabled: checkoutEnabled ?? before.checkoutEnabled,
        updatedByUserId: actor.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({ target: storeSettings.id, set: values });
    const after = await getStoreConfiguration(db);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "settings.store_updated",
      entityType: "store_settings",
      entityId: "store",
      before: serializeStore(before),
      after: serializeStore(after),
    });
    return Response.json({ store: serializeStore(after) });
  } catch (error) {
    return adminError(error);
  }
}

export function serializeStore(row: Awaited<ReturnType<typeof getStoreConfiguration>>) {
  return {
    storeName: row.storeName,
    supportEmail: row.supportEmail,
    currency: row.currency,
    publicOrigin: row.publicOrigin ?? "",
    checkoutEnabled: row.checkoutEnabled,
    allowedShippingCountries: parseShippingCountries(
      row.allowedShippingCountriesJson,
    ),
    flatShippingCents: row.flatShippingCents,
    automaticTaxEnabled: row.automaticTaxEnabled,
    updatedAt: row.updatedAt,
  };
}

export function parseShippingCountries(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const countries = parsed.filter(
        (item): item is string =>
          typeof item === "string" && ISO_ALPHA_2.has(item),
      );
      if (countries.length) return [...new Set(countries)];
    }
  } catch {
    // Use the safe default below.
  }
  return ["US"];
}

function shippingCountriesUpdate(body: Record<string, unknown>): string[] | undefined {
  if (!Object.hasOwn(body, "allowedShippingCountries")) return undefined;
  if (!Array.isArray(body.allowedShippingCountries)) {
    throw new ApiError(
      400,
      "invalid_field",
      "allowedShippingCountries must be a list of ISO country codes.",
    );
  }
  const countries = [
    ...new Set(
      body.allowedShippingCountries.map((value) =>
        typeof value === "string" ? value.trim().toUpperCase() : "",
      ),
    ),
  ];
  if (
    countries.length < 1 ||
    countries.length > 25 ||
    countries.some((country) => !ISO_ALPHA_2.has(country))
  ) {
    throw new ApiError(
      400,
      "invalid_field",
      "Provide 1 to 25 valid ISO alpha-2 shipping country codes.",
    );
  }
  return countries;
}

function originUpdate(body: Record<string, unknown>): string | null | undefined {
  if (!Object.hasOwn(body, "publicOrigin")) return undefined;
  if (body.publicOrigin === null || body.publicOrigin === "") return null;
  if (typeof body.publicOrigin !== "string" || body.publicOrigin.length > 500) {
    throw new ApiError(400, "invalid_field", "publicOrigin is invalid.");
  }
  try {
    const parsed = new URL(body.publicOrigin.trim());
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
    ) {
      throw new Error("invalid");
    }
    return parsed.origin;
  } catch {
    throw new ApiError(
      400,
      "invalid_field",
      "publicOrigin must be an HTTPS origin without a path.",
    );
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

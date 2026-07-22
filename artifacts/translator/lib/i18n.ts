/**
 * i18n bootstrap for LingoSwap.
 *
 * Initialises i18next synchronously so translations are available before the
 * first render. The device locale (from expo-localization) is used as the
 * initial language; if the device language is not in our supported set we fall
 * back to English.
 *
 * Persisted language preference is read from AsyncStorage in `app/_layout.tsx`
 * via the LANG_STORAGE_KEY export and applied with `i18n.changeLanguage()`.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import ar from "@/locales/ar.json";
import bn from "@/locales/bn.json";
import bg from "@/locales/bg.json";
import zh from "@/locales/zh.json";
import hr from "@/locales/hr.json";
import cs from "@/locales/cs.json";
import da from "@/locales/da.json";
import nl from "@/locales/nl.json";
import en from "@/locales/en.json";
import et from "@/locales/et.json";
import fi from "@/locales/fi.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import el from "@/locales/el.json";
import he from "@/locales/he.json";
import hi from "@/locales/hi.json";
import hu from "@/locales/hu.json";
import id from "@/locales/id.json";
import it from "@/locales/it.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import lv from "@/locales/lv.json";
import lt from "@/locales/lt.json";
import no from "@/locales/no.json";
import pl from "@/locales/pl.json";
import pt from "@/locales/pt.json";
import ro from "@/locales/ro.json";
import ru from "@/locales/ru.json";
import sr from "@/locales/sr.json";
import sk from "@/locales/sk.json";
import sl from "@/locales/sl.json";
import es from "@/locales/es.json";
import sv from "@/locales/sv.json";
import th from "@/locales/th.json";
import tr from "@/locales/tr.json";
import uk from "@/locales/uk.json";
import vi from "@/locales/vi.json";

import { SUPPORTED_LOCALE_CODES } from "@/constants/localeCodes";

export const LANG_STORAGE_KEY = "@lingoswap/ui_language";

function detectDeviceLocale(): string {
  try {
    const locales = Localization.getLocales();
    const tag = locales[0]?.languageTag ?? "en";
    const lang = tag.split("-")[0].toLowerCase();
    return SUPPORTED_LOCALE_CODES.includes(lang) ? lang : "en";
  } catch {
    return "en";
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      ar: { translation: ar },
      bn: { translation: bn },
      bg: { translation: bg },
      zh: { translation: zh },
      hr: { translation: hr },
      cs: { translation: cs },
      da: { translation: da },
      nl: { translation: nl },
      en: { translation: en },
      et: { translation: et },
      fi: { translation: fi },
      fr: { translation: fr },
      de: { translation: de },
      el: { translation: el },
      he: { translation: he },
      hi: { translation: hi },
      hu: { translation: hu },
      id: { translation: id },
      it: { translation: it },
      ja: { translation: ja },
      ko: { translation: ko },
      lv: { translation: lv },
      lt: { translation: lt },
      no: { translation: no },
      pl: { translation: pl },
      pt: { translation: pt },
      ro: { translation: ro },
      ru: { translation: ru },
      sr: { translation: sr },
      sk: { translation: sk },
      sl: { translation: sl },
      es: { translation: es },
      sv: { translation: sv },
      th: { translation: th },
      tr: { translation: tr },
      uk: { translation: uk },
      vi: { translation: vi },
    },
    lng: detectDeviceLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
  });
}

export default i18n;

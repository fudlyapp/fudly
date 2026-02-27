// src/lib/i18n/dict.ts

export type Lang = "sk" | "en" | "ua";

export type Dict = {
  common: {
    loading: string;
    errorPrefix: string;
    send: string;
    sentOk: string;
    required: string;
    close: string;
    save: string;
    saved: string;

    back: string;
    genericError: string;
  };

  nav: {
    generator: string;
    pricing: string;
    profile: string;
    contact: string;
    legal: string;
    logout: string;
    login: string;
  };

  home: {
    title: string;
    subtitle: string;
    tagline: string;
    ctaPrimary: string;
    ctaSecondary: string;

    f1Title: string;
    f1Desc: string;
    f2Title: string;
    f2Desc: string;
    f3Title: string;
    f3Desc: string;
  };

  auth: {
    title: string;
    subtitle: string;

    loginTab: string;
    signupTab: string;

    emailLabel: string;
    emailPlaceholder: string;

    passwordLabel: string;
    passwordPlaceholder: string;

    loginCta: string;
    signupCta: string;

    signupSuccess: string;
  };

  pricing: {
    title: string;
    subtitle: string;

    subscribe: string;
    manage: string;

    basic: {
      title: string;
      subtitle: string;
      note: string;
      features: string[];
    };

    plus: {
      title: string;
      subtitle: string;
      note: string;
      features: string[];
    };

    ui: {
      loggedAs: string;
      status: string;
      plan: string;
      mustLogin: string;

      active: string;
      lowerPlan: string;
      activePlanHint: string;

      upgradeToPlus: string;
      youHaveActiveBasic: string;
      youHaveActivePlus: string;
      plusViaUpgrade: string;
    };
  };

  generator: {
    title: string;
    subtitle: string;
    loginToGenerate: string;

    week: string;
    people: string;
    budget: string;
    language: string;

    style: string;
    trips: string;
    repeatDays: string;

    intolerances: string;
    avoid: string;
    have: string;
    favorites: string;

    loadSaved: string;
    saveAsDefault: string;

    ready: string;
    checkInputs: string;

    generate: string;
    generating: string;

    checkingAuth: string;
    loggedAs: string;
    profile: string;
    logout: string;
    login: string;

    thisWeek: string;
    nextWeek: string;

    hardBanHint: string;
    softPrefHint: string;
    wasteLessHint: string;
    tastyHint: string;

    generations: string;
    remaining: string;

    loadProfileNoDefaults: string;
    loadedFromProfile: string;
    savedToProfile: string;

    // TOTO TI CHÝBALO (errors na screenshote)
    loadProfileError: string;
    saveProfileError: string;

    overwriteTitle: (weekLabel: string) => string;
    emptySavedPlan: string;

    limitReached: (n: number) => string;
    plusOnlyStyle: (label: string) => string;
    notLoggedIn: string;

    serverError: (payload: string) => string;
    generatedButSaveFailed: (msg: string) => string;
    unexpectedServer: string;

    generateCtaHint: (limit: number) => string;
    generateCtaHintOk: string;

    planningTip: string;

    // ak niekde ešte používaš starý názov
    tipMovedDown: string;
  };

  profile: {
    title: string;
    subtitle: string;
    loggedAs: string;

    tabs: {
      plans: string;
      shopping: string;
      calories: string;
      finance: string;
      defaults: string;
    };

    filters: {
      allYears: string;
      allMonths: string;
      pickYearFirst: string;
    };
  };

  contact: {
    title: string;
    subtitle: string;
    name: string;
    email: string;
    message: string;
    send: string;
    success: string;
    fail: string;
  };

  legal: {
    title: string;
    updated: string;
    sections: {
      termsTitle: string;
      privacyTitle: string;
      refundTitle: string;
    };

    terms: {
      intro: string;
      service: string[];
      account: string[];
      pricing: string[];
      liability: string[];
    };

    privacy: {
      intro: string;
      data: string[];
      purpose: string[];
      retention: string[];
      rights: string[];
      contact: string;
    };

    refund: {
      intro: string;
      cancel: string[];
      refunds: string[];
      trial: string[];
    };
  };
};

// ✅ kľúčový fix: žiadne `as const` na celý DICT.
// Použijeme `satisfies` => kontrola tvaru, ale hodnoty ostanú typu `string` (nie literal).
export const DICT = {
  sk: {
    common: {
      loading: "Načítavam…",
      errorPrefix: "Chyba:",
      send: "Odoslať",
      sentOk: "Odoslané.",
      required: "Povinné",
      close: "Zavrieť",
      save: "Uložiť",
      saved: "Uložené",
      back: "Späť",
      genericError: "Nastala chyba.",
    },

    nav: {
      generator: "Generátor",
      pricing: "Cenník",
      profile: "Profil",
      contact: "Kontakt",
      legal: "Dokumenty",
      logout: "Odhlásiť sa",
      login: "Prihlásiť sa",
    },

    home: {
      title: "Fudly",
      subtitle: "Tvoj inteligentný plánovač.",
      tagline: "Smart food decisions.",
      ctaPrimary: "Otvoriť generátor",
      ctaSecondary: "Pozrieť cenník",

      f1Title: "Jedálniček",
      f1Desc: "Týždenný plán bez chaosu.",
      f2Title: "Nákupy",
      f2Desc: "Zoznam aj odhad nákladov.",
      f3Title: "Bez starostí",
      f3Desc: "Generovanie na pár klikov.",
    },

    auth: {
      title: "Fudly účet",
      subtitle: "Prihlásenie / registrácia",
      loginTab: "Prihlásiť",
      signupTab: "Vytvoriť účet",
      emailLabel: "E-mail",
      emailPlaceholder: "napr. fudly@fudly.sk",
      passwordLabel: "Heslo",
      passwordPlaceholder: "••••••••",
      loginCta: "Prihlásiť",
      signupCta: "Vytvoriť účet",
      signupSuccess: "Účet vytvorený. Skús sa prihlásiť (alebo potvrď e-mail, ak to vyžaduje nastavenie).",
    },

    pricing: {
      title: "Cenník",
      subtitle: "Členstvá a čo obsahujú.",
      subscribe: "Predplatiť",
      manage: "Spravovať",

      basic: {
        title: "Basic",
        subtitle: "Platené členstvo • 3 generovania / týždeň",
        note: "Kalórie a štýly Fit/Tradičné/Exotické budú v Plus.",
        features: [
          "Generovanie jedálničkov + nákupov",
          "Uložené plány a nákupy v profile",
          "Predvolené preferencie",
          "Štýly: Lacné, Rýchle, Vyvážené, Vegetariánske",
        ],
      },

      plus: {
        title: "Plus",
        subtitle: "Platené členstvo • 5 generovaní / týždeň",
        note: "Platby a aktiváciu členstva doplníme v ďalšej fáze.",
        features: ["Všetko z Basic", "Kalórie (prehľad + filtrovanie)", "Štýly: Fit, Tradičné, Exotické", "Vyšší limit generovania"],
      },

      ui: {
        loggedAs: "Prihlásený ako",
        status: "status",
        plan: "plan",
        mustLogin: "Pre predplatné sa musíš prihlásiť.",

        active: "Aktívne",
        lowerPlan: "Nižší plán",
        activePlanHint: "Tento plán je už aktívny alebo máš vyšší.",

        upgradeToPlus: "Upgrade na Plus",
        youHaveActiveBasic: "Máš aktívny Basic.",
        youHaveActivePlus: "Máš aktívny Plus.",
        plusViaUpgrade: "Plus môžeš aktivovať cez Upgrade.",
      },
    },

    generator: {
      title: "Týždenný jedálniček + nákupy",
      subtitle: "Nastav preferencie a vygeneruj si týždeň.",
      loginToGenerate: "Prihlásiť sa a generovať",

      week: "Týždeň (pondelok–nedeľa)",
      people: "Počet ľudí (1–6)",
      budget: "Budget / týždeň (€) (1–1000)",
      language: "Jazyk",

      style: "Preferovaný štýl",
      trips: "Nákupy / týždeň",
      repeatDays: "Varenie na viac dní",

      intolerances: "❌ Intolerancie / NESMÚ byť použité",
      avoid: "Vyhnúť sa",
      have: "Mám doma (použi)",
      favorites: "Obľúbené",

      loadSaved: "Načítať uložené",
      saveAsDefault: "Uložiť ako predvolené",

      ready: "✅ pripravené",
      checkInputs: "Skontroluj: týždeň, počet ľudí 1–6, budget 1–1000",

      generate: "Vygenerovať",
      generating: "Generujem...",

      checkingAuth: "Kontrolujem prihlásenie…",
      loggedAs: "Prihlásený ako",
      profile: "Profil",
      logout: "Odhlásiť sa",
      login: "Prihlásiť sa",

      thisWeek: "Tento",
      nextWeek: "Budúci",

      hardBanHint: "tvrdý zákaz",
      softPrefHint: "mäkká preferencia",
      wasteLessHint: "minimalizuj odpad",
      tastyHint: "nech je to chutné",

      generations: "generovaní",
      remaining: "zostáva",

      loadProfileNoDefaults: "Nemáš ešte uložené predvolené. Ulož ich v profile.",
      loadedFromProfile: "✅ Načítané z profilu.",
      savedToProfile: "✅ Uložené ako predvolené do profilu.",

      loadProfileError: "Chyba pri načítaní profilu:",
      saveProfileError: "Chyba pri ukladaní profilu:",

      overwriteTitle: (weekLabel: string) =>
        `Pre týždeň ${weekLabel} už máš uložený jedálniček.\n\nChceš ho prepísať novým generovaním?`,
      emptySavedPlan: "Tento týždeň má uložený záznam, ale plán je prázdny.",

      limitReached: (n: number) => `Dosiahol si limit generovaní pre tento týždeň (${n}).`,
      plusOnlyStyle: (label: string) => `Štýl „${label}“ je dostupný iba v Plus členstve.`,
      notLoggedIn: "Nie si prihlásený.",

      serverError: (payload: string) => `Chyba: ${payload}`,
      generatedButSaveFailed: (msg: string) => `Plán sa vygeneroval, ale nepodarilo sa ho uložiť: ${msg}`,
      unexpectedServer: "Chyba: neočakávaná odpoveď zo servera.",

      generateCtaHint: (limit: number) => `Limit pre týždeň: ${limit} generovaní`,
      generateCtaHintOk: "Vygenerovať a automaticky uložiť",

      planningTip:
        "Plánovanie môže trvať 2–3 minúty (jedálniček + nákupy + recepty). Počas generovania stránku nerefrešuj.",

      tipMovedDown:
        "Plánovanie môže trvať 2–3 minúty (jedálniček + nákupy + recepty). Počas generovania stránku nerefrešuj.",
    },

    profile: {
      title: "Profil",
      subtitle: "Prehľad: predvolené, jedálničky, nákupy, kalórie a financie.",
      loggedAs: "Prihlásený ako",

      tabs: {
        plans: "Uložené jedálničky",
        shopping: "Uložené nákupy",
        calories: "Kalórie",
        finance: "Financie",
        defaults: "Predvolené",
      },

      filters: {
        allYears: "Všetky roky",
        allMonths: "Všetky mesiace",
        pickYearFirst: "Najprv vyber rok",
      },
    },

    contact: {
      title: "Kontakt",
      subtitle: "Napíš nám a ozveme sa čo najskôr.",
      name: "Meno",
      email: "Email",
      message: "Správa",
      send: "Odoslať",
      success: "✅ Správa bola odoslaná.",
      fail: "Niečo sa pokazilo. Skús to prosím znova.",
    },

    legal: {
      title: "Dokumenty",
      updated: "Naposledy aktualizované:",
      sections: {
        termsTitle: "Obchodné podmienky",
        privacyTitle: "Ochrana osobných údajov (GDPR)",
        refundTitle: "Zrušenie a refundácie",
      },

      terms: {
        intro: "Tieto podmienky upravujú používanie služby Fudly (generovanie jedálničkov, nákupov a receptov).",
        service: [
          "Služba poskytuje odporúčania a výstupy generované algoritmicky.",
          "Výstupy majú informatívny charakter a nenahrádzajú odborné poradenstvo.",
        ],
        account: [
          "Používateľ zodpovedá za správnosť údajov, ktoré do služby zadá.",
          "Prístup k účtu si chráň; za použitie účtu zodpovedá používateľ.",
        ],
        pricing: [
          "Platené členstvá poskytujú vyššie limity a rozšírené funkcie.",
          "Ceny a rozsah funkcií sa môžu meniť; zmeny oznámime primerane vopred.",
        ],
        liability: [
          "Nezodpovedáme za škody spôsobené nesprávnym použitím výstupov.",
          "Pri zdravotných obmedzeniach odporúčame konzultovať lekára alebo odborníka na výživu.",
        ],
      },

      privacy: {
        intro: "Spracúvame len údaje potrebné na poskytovanie služby (účty, uložené plány, preferencie, kontaktné správy).",
        data: [
          "Identifikačné údaje: email (a prípadne meno, ak ho uvedieš).",
          "Údaje v profile: preferencie, intolerancie, nastavenia.",
          "Uložené plány: jedálničky, nákupy, recepty.",
        ],
        purpose: [
          "Poskytovanie a zlepšovanie služby.",
          "Zákaznícka podpora a riešenie požiadaviek.",
          "Fakturácia/platby cez Stripe (ak je aktívne členstvo).",
        ],
        retention: [
          "Údaje uchovávame počas trvania účtu a primerane po jeho zrušení.",
          "Kontaktné správy uchovávame len po dobu potrebnú na vybavenie.",
        ],
        rights: [
          "Máš právo na prístup k údajom, opravu, vymazanie a obmedzenie spracúvania.",
          "Máš právo namietať a podať sťažnosť na dozorný orgán.",
        ],
        contact: "Ak chceš riešiť GDPR otázky, napíš nám cez Kontakt.",
      },

      refund: {
        intro: "Členstvo môžeš kedykoľvek zrušiť v Stripe portáli. Po zrušení zostane aktívne do konca fakturačného obdobia.",
        cancel: ["Zrušenie sa vykonáva cez tlačidlo Spravovať (Stripe zákaznícky portál).", "Po zrušení už nebude prebiehať ďalšie fakturovanie."],
        refunds: ["Refundácie riešime individuálne podľa situácie a legislatívy.", "Ak sa domnievaš, že došlo k chybe v platbe, kontaktuj nás cez Kontakt."],
        trial: ["Počas trial obdobia môžeš zrušiť členstvo bez ďalšieho účtovania.", "Ak trial skončí a členstvo nie je zrušené, môže dôjsť k začatiu fakturácie."],
      },
    },
  },

  // --- EN ---
  en: {
    common: {
      loading: "Loading…",
      errorPrefix: "Error:",
      send: "Send",
      sentOk: "Sent.",
      required: "Required",
      close: "Close",
      save: "Save",
      saved: "Saved",
      back: "Back",
      genericError: "Something went wrong.",
    },

    nav: {
      generator: "Generator",
      pricing: "Pricing",
      profile: "Profile",
      contact: "Contact",
      legal: "Legal",
      logout: "Log out",
      login: "Log in",
    },

    home: {
      title: "Fudly",
      subtitle: "Your smart meal planner.",
      tagline: "Smart food decisions.",
      ctaPrimary: "Open generator",
      ctaSecondary: "View pricing",

      f1Title: "Meal plan",
      f1Desc: "A weekly plan without chaos.",
      f2Title: "Groceries",
      f2Desc: "Shopping list + cost estimate.",
      f3Title: "Stress-free",
      f3Desc: "Generate in a few clicks.",
    },

    auth: {
      title: "Fudly account",
      subtitle: "Login / sign up",
      loginTab: "Log in",
      signupTab: "Sign up",
      emailLabel: "Email",
      emailPlaceholder: "e.g. fudly@fudly.sk",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      loginCta: "Log in",
      signupCta: "Create account",
      signupSuccess: "Account created. Please log in (or confirm your email if required).",
    },

    pricing: {
      title: "Pricing",
      subtitle: "Memberships and what they include.",
      subscribe: "Subscribe",
      manage: "Manage",

      basic: {
        title: "Basic",
        subtitle: "Paid membership • 3 generations / week",
        note: "Calories and Fit/Traditional/Exotic styles are available in Plus.",
        features: ["Meal plan + shopping list generation", "Saved plans and shopping in profile", "Saved preferences", "Styles: Budget, Quick, Balanced, Vegetarian"],
      },

      plus: {
        title: "Plus",
        subtitle: "Paid membership • 5 generations / week",
        note: "Payments and activation will be refined in a later phase.",
        features: ["Everything in Basic", "Calories (overview + filtering)", "Styles: Fit, Traditional, Exotic", "Higher generation limit"],
      },

      ui: {
        loggedAs: "Logged in as",
        status: "status",
        plan: "plan",
        mustLogin: "You need to log in to subscribe.",

        active: "Active",
        lowerPlan: "Lower plan",
        activePlanHint: "This plan is already active or you have a higher one.",

        upgradeToPlus: "Upgrade to Plus",
        youHaveActiveBasic: "You have an active Basic plan.",
        youHaveActivePlus: "You have an active Plus plan.",
        plusViaUpgrade: "You can activate Plus via upgrade.",
      },
    },

    generator: {
      title: "Weekly meal plan + groceries",
      subtitle: "Set your preferences and generate your week.",
      loginToGenerate: "Log in to generate",

      week: "Week (Mon–Sun)",
      people: "People (1–6)",
      budget: "Budget / week (€) (1–1000)",
      language: "Language",

      style: "Preferred style",
      trips: "Shopping trips / week",
      repeatDays: "Cook for multiple days",

      intolerances: "❌ Intolerances / MUST NOT be used",
      avoid: "Avoid",
      have: "I have at home (use)",
      favorites: "Favorites",

      loadSaved: "Load saved",
      saveAsDefault: "Save as default",

      ready: "✅ ready",
      checkInputs: "Check: week, people 1–6, budget 1–1000",

      generate: "Generate",
      generating: "Generating...",

      checkingAuth: "Checking login…",
      loggedAs: "Logged in as",
      profile: "Profile",
      logout: "Log out",
      login: "Log in",

      thisWeek: "This",
      nextWeek: "Next",

      hardBanHint: "hard ban",
      softPrefHint: "soft preference",
      wasteLessHint: "reduce waste",
      tastyHint: "make it tasty",

      generations: "generations",
      remaining: "remaining",

      loadProfileNoDefaults: "You don’t have saved defaults yet. Save them in your profile.",
      loadedFromProfile: "✅ Loaded from profile.",
      savedToProfile: "✅ Saved as defaults to profile.",

      loadProfileError: "Failed to load profile:",
      saveProfileError: "Failed to save profile:",

      overwriteTitle: (weekLabel: string) =>
        `You already have a saved plan for ${weekLabel}.\n\nDo you want to overwrite it with a new generation?`,
      emptySavedPlan: "You have a saved record for this week, but the plan is empty.",

      limitReached: (n: number) => `You reached the generation limit for this week (${n}).`,
      plusOnlyStyle: (label: string) => `Style “${label}” is available only in Plus.`,
      notLoggedIn: "You are not logged in.",

      serverError: (payload: string) => `Error: ${payload}`,
      generatedButSaveFailed: (msg: string) => `Plan generated, but failed to save: ${msg}`,
      unexpectedServer: "Error: unexpected server response.",

      generateCtaHint: (limit: number) => `Weekly limit: ${limit} generations`,
      generateCtaHintOk: "Generate and auto-save",

      planningTip: "Planning can take 2–3 minutes (meal plan + groceries + recipes). Don’t refresh during generation.",
      tipMovedDown: "Planning can take 2–3 minutes (meal plan + groceries + recipes). Don’t refresh during generation.",
    },

    profile: {
      title: "Profile",
      subtitle: "Overview: defaults, meal plans, shopping, calories and finances.",
      loggedAs: "Logged in as",

      tabs: {
        plans: "Saved meal plans",
        shopping: "Saved shopping",
        calories: "Calories",
        finance: "Finances",
        defaults: "Defaults",
      },

      filters: {
        allYears: "All years",
        allMonths: "All months",
        pickYearFirst: "Pick a year first",
      },
    },

    contact: {
      title: "Contact",
      subtitle: "Send us a message and we’ll get back to you.",
      name: "Name",
      email: "Email",
      message: "Message",
      send: "Send",
      success: "✅ Message sent.",
      fail: "Something went wrong. Please try again.",
    },

    legal: {
      title: "Legal",
      updated: "Last updated:",
      sections: {
        termsTitle: "Terms & Conditions",
        privacyTitle: "Privacy (GDPR)",
        refundTitle: "Cancellation & Refunds",
      },

      terms: {
        intro: "These terms govern the use of Fudly (meal plans, shopping lists and recipes).",
        service: ["The service provides algorithmically generated suggestions and outputs.", "Outputs are informational and do not replace professional advice."],
        account: ["You are responsible for the accuracy of the inputs you provide.", "Keep your account secure; you are responsible for its use."],
        pricing: ["Paid memberships offer higher limits and extended features.", "Pricing and features may change; we will notify you reasonably in advance."],
        liability: ["We are not liable for damages resulting from improper use of outputs.", "For medical conditions, consult a doctor or nutrition professional."],
      },

      privacy: {
        intro: "We process only data necessary to provide the service (accounts, saved plans, preferences, contact messages).",
        data: ["Identifiers: email (and optionally name).", "Profile data: preferences, intolerances, settings.", "Saved plans: meal plans, shopping lists, recipes."],
        purpose: ["Provide and improve the service.", "Customer support and request handling.", "Billing/payments via Stripe (when membership is active)."],
        retention: ["We keep data while your account is active and for a reasonable period after deletion.", "Contact messages are kept only as long as needed to handle the request."],
        rights: ["You have the right to access, rectify, erase and restrict processing.", "You have the right to object and lodge a complaint with a supervisory authority."],
        contact: "For GDPR requests, contact us via the Contact page.",
      },

      refund: {
        intro: "You can cancel anytime in the Stripe customer portal. Your plan remains active until the end of the billing period.",
        cancel: ["Cancellation is done via Manage (Stripe customer portal).", "After cancellation, no further billing occurs."],
        refunds: ["Refunds are handled case-by-case, subject to law.", "If you believe a payment was incorrect, contact us via Contact."],
        trial: ["During the trial you can cancel without further charges.", "If the trial ends and you don’t cancel, billing may start."],
      },
    },
  },

  // --- UA ---
  ua: {
    common: {
      loading: "Завантаження…",
      errorPrefix: "Помилка:",
      send: "Надіслати",
      sentOk: "Надіслано.",
      required: "Обов’язково",
      close: "Закрити",
      save: "Зберегти",
      saved: "Збережено",
      back: "Назад",
      genericError: "Сталася помилка.",
    },

    nav: {
      generator: "Генератор",
      pricing: "Тарифи",
      profile: "Профіль",
      contact: "Контакт",
      legal: "Документи",
      logout: "Вийти",
      login: "Увійти",
    },

    home: {
      title: "Fudly",
      subtitle: "ТТвій розумний планувальник!",
      tagline: "Smart food decisions.",
      ctaPrimary: "Відкрити генератор",
      ctaSecondary: "Переглянути тарифи",

      f1Title: "Раціон",
      f1Desc: "Тижневий план без хаосу.",
      f2Title: "Покупки",
      f2Desc: "Список покупок + оцінка вартості.",
      f3Title: "Без турбот",
      f3Desc: "Генерація в кілька кліків.",
    },

    auth: {
      title: "Обліковий запис Fudly",
      subtitle: "Вхід / реєстрація",
      loginTab: "Увійти",
      signupTab: "Створити акаунт",
      emailLabel: "Email",
      emailPlaceholder: "наприклад, fudly@fudly.sk",
      passwordLabel: "Пароль",
      passwordPlaceholder: "••••••••",
      loginCta: "Увійти",
      signupCta: "Створити акаунт",
      signupSuccess: "Акаунт створено. Спробуй увійти (або підтвердь email, якщо це потрібно).",
    },

    pricing: {
      title: "Тарифи",
      subtitle: "Підписки та що вони містять.",
      subscribe: "Оформити",
      manage: "Керувати",

      basic: {
        title: "Basic",
        subtitle: "Платна підписка • 3 генерації / тиждень",
        note: "Калорії та стилі Fit/Традиційне/Екзотичне доступні у Plus.",
        features: ["Генерація раціону + списку покупок", "Збережені плани та покупки в профілі", "Збережені налаштування", "Стилі: Бюджетно, Швидко, Збалансовано, Вегетаріанське"],
      },

      plus: {
        title: "Plus",
        subtitle: "Платна підписка • 5 генерацій / тиждень",
        note: "Оплати та активацію буде уточнено на наступному етапі.",
        features: ["Усе з Basic", "Калорії (огляд + фільтри)", "Стилі: Fit, Традиційне, Екзотичне", "Вищий ліміт генерацій"],
      },

      ui: {
        loggedAs: "Увійшов як",
        status: "статус",
        plan: "план",
        mustLogin: "Щоб оформити підписку, потрібно увійти.",

        active: "Активно",
        lowerPlan: "Нижчий план",
        activePlanHint: "Цей план уже активний або у вас вищий.",

        upgradeToPlus: "Оновити до Plus",
        youHaveActiveBasic: "У вас активний Basic.",
        youHaveActivePlus: "У вас активний Plus.",
        plusViaUpgrade: "Plus можна активувати через оновлення.",
      },
    },

    generator: {
      title: "Тижневий раціон + покупки",
      subtitle: "Налаштуй уподобання та згенеруй тиждень.",
      loginToGenerate: "Увійти та згенерувати",

      week: "Тиждень (Пн–Нд)",
      people: "Кількість людей (1–6)",
      budget: "Бюджет / тиждень (€) (1–1000)",
      language: "Мова",

      style: "Стиль",
      trips: "Покупки / тиждень",
      repeatDays: "Готувати на кілька днів",

      intolerances: "❌ Непереносимості / НЕ МОЖНА використовувати",
      avoid: "Уникати",
      have: "Є вдома (використай)",
      favorites: "Улюблене",

      loadSaved: "Завантажити збережене",
      saveAsDefault: "Зберегти як стандарт",

      ready: "✅ готово",
      checkInputs: "Перевір: тиждень, людей 1–6, бюджет 1–1000",

      generate: "Згенерувати",
      generating: "Генерую...",

      checkingAuth: "Перевіряю вхід…",
      loggedAs: "Увійшов як",
      profile: "Профіль",
      logout: "Вийти",
      login: "Увійти",

      thisWeek: "Цей",
      nextWeek: "Наступний",

      hardBanHint: "жорстка заборона",
      softPrefHint: "м’яка перевага",
      wasteLessHint: "мінімізуй відходи",
      tastyHint: "нехай буде смачно",

      generations: "генерацій",
      remaining: "залишилось",

      loadProfileNoDefaults: "У тебе ще немає збережених налаштувань. Збережи їх у профілі.",
      loadedFromProfile: "✅ Завантажено з профілю.",
      savedToProfile: "✅ Збережено як стандарт у профілі.",

      loadProfileError: "Помилка завантаження профілю:",
      saveProfileError: "Помилка збереження профілю:",

      overwriteTitle: (weekLabel: string) =>
        `Для тижня ${weekLabel} у тебе вже є збережений план.\n\nПерезаписати його новою генерацією?`,
      emptySavedPlan: "Є збережений запис за цей тиждень, але план порожній.",

      limitReached: (n: number) => `Ти досяг ліміту генерацій на цей тиждень (${n}).`,
      plusOnlyStyle: (label: string) => `Стиль “${label}” доступний лише в Plus.`,
      notLoggedIn: "Ти не увійшов.",

      serverError: (payload: string) => `Помилка: ${payload}`,
      generatedButSaveFailed: (msg: string) => `План згенеровано, але не вдалося зберегти: ${msg}`,
      unexpectedServer: "Помилка: неочікувана відповідь сервера.",

      generateCtaHint: (limit: number) => `Ліміт на тиждень: ${limit} генерацій`,
      generateCtaHintOk: "Згенерувати й зберегти",

      planningTip: "Планування може тривати 2–3 хвилини (раціон + покупки + рецепти). Не оновлюй сторінку під час генерації.",
      tipMovedDown: "Планування може тривати 2–3 хвилини (раціон + покупки + рецепти). Не оновлюй сторінку під час генерації.",
    },

    profile: {
      title: "Профіль",
      subtitle: "Огляд: налаштування, раціони, покупки, калорії та фінанси.",
      loggedAs: "Увійшов як",

      tabs: {
        plans: "Збережені раціони",
        shopping: "Збережені покупки",
        calories: "Калорії",
        finance: "Фінанси",
        defaults: "Налаштування",
      },

      filters: {
        allYears: "Усі роки",
        allMonths: "Усі місяці",
        pickYearFirst: "Спочатку вибери рік",
      },
    },

    contact: {
      title: "Контакт",
      subtitle: "Напишіть нам — ми відповімо якнайшвидше.",
      name: "Ім’я",
      email: "Email",
      message: "Повідомлення",
      send: "Надіслати",
      success: "✅ Повідомлення надіслано.",
      fail: "Щось пішло не так. Спробуйте ще раз.",
    },

    legal: {
      title: "Документи",
      updated: "Останнє оновлення:",
      sections: {
        termsTitle: "Умови користування",
        privacyTitle: "Конфіденційність (GDPR)",
        refundTitle: "Скасування та повернення коштів",
      },

      terms: {
        intro: "Ці умови регулюють використання Fudly (раціони, покупки та рецепти).",
        service: ["Сервіс надає алгоритмічно згенеровані рекомендації та результати.", "Результати мають інформаційний характер і не замінюють професійну консультацію."],
        account: ["Користувач відповідає за точність введених даних.", "Захищайте доступ до акаунту; відповідальність за використання несе користувач."],
        pricing: ["Платні підписки дають вищі ліміти та розширені функції.", "Ціни та функції можуть змінюватись; ми повідомимо завчасно."],
        liability: ["Ми не несемо відповідальності за збитки через неправильне використання результатів.", "За наявності медичних обмежень зверніться до лікаря/дієтолога."],
      },

      privacy: {
        intro: "Ми обробляємо лише дані, потрібні для роботи сервісу (акаунт, збережені плани, налаштування, повідомлення).",
        data: ["Ідентифікація: email (та опційно ім’я).", "Дані профілю: налаштування, непереносимості.", "Збережені плани: раціони, покупки, рецепти."],
        purpose: ["Надання та покращення сервісу.", "Підтримка користувачів.", "Оплати через Stripe (коли підписка активна)."],
        retention: ["Дані зберігаються під час існування акаунту та розумний період після видалення.", "Контактні повідомлення — лише доки потрібно для відповіді."],
        rights: ["Право доступу, виправлення, видалення, обмеження обробки.", "Право заперечити та подати скаргу до наглядового органу."],
        contact: "Для GDPR-запитів напишіть через сторінку Контакт.",
      },

      refund: {
        intro: "Ви можете скасувати підписку в Stripe-порталі. Вона залишиться активною до кінця періоду.",
        cancel: ["Скасування виконується через Керувати (Stripe портал).", "Після скасування подальші списання не відбуватимуться."],
        refunds: ["Повернення коштів розглядаємо індивідуально згідно із законом.", "Якщо вважаєте платіж помилковим — напишіть через Контакт."],
        trial: ["Під час trial можна скасувати без подальших списань.", "Після завершення trial може початися оплата, якщо не скасувати."],
      },
    },
  },
} satisfies Record<Lang, Dict>;
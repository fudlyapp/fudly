export type Lang = "sk" | "en" | "uk";

export type Dict = {
  nav: {
    generator: string;
    profile: string;
    pricing: string;
    login: string;
    logout: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    basic: {
      title: string;
      subtitle: string;
      features: string[];
      note: string;
    };
    plus: {
      title: string;
      subtitle: string;
      features: string[];
      note: string;
    };
    subscribe: string;
    manage: string;
  };
  profile: {
    title: string;
  };
};

export const DICT: Record<Lang, Dict> = {
  sk: {
    nav: {
      generator: "Generátor",
      profile: "Profil",
      pricing: "Cenník",
      login: "Prihlásiť sa",
      logout: "Odhlásiť",
    },
    pricing: {
      title: "Cenník",
      subtitle: "Členstvá a čo obsahujú. (Platby doplníme v ďalšom kroku.)",
      basic: {
        title: "Basic",
        subtitle: "Platené členstvo • 3 generovania / týždeň",
        features: [
          "Generovanie jedálničkov + nákupov",
          "Uložené plány a nákupy v profile",
          "Predvolené preferencie",
          "Štýly: Lacné, Rýchle, Vyvážené, Vegetariánske",
        ],
        note: "Kalórie a štýly Fit/Tradičné/Exotické budú v Plus.",
      },
      plus: {
        title: "Plus",
        subtitle: "Platené členstvo • 5 generovaní / týždeň",
        features: [
          "Všetko z Basic",
          "Kalórie (prehľad + filtrovanie)",
          "Štýly: Fit, Tradičné, Exotické",
          "Vyšší limit generovania",
        ],
        note: "Platby a aktiváciu členstva doplníme v ďalšej fáze.",
      },
      subscribe: "Predplatiť",
      manage: "Spravovať",
    },
    profile: { title: "Profil" },
  },

  en: {
    nav: {
      generator: "Generator",
      profile: "Profile",
      pricing: "Pricing",
      login: "Sign in",
      logout: "Sign out",
    },
    pricing: {
      title: "Pricing",
      subtitle: "Memberships and what they include. (Payments will be added in the next step.)",
      basic: {
        title: "Basic",
        subtitle: "Paid membership • 3 generations / week",
        features: ["Meal plan + shopping generation", "Saved plans in profile", "Saved defaults", "Styles: Cheap, Quick, Balanced, Vegetarian"],
        note: "Calories and Fit/Traditional/Exotic styles are in Plus.",
      },
      plus: {
        title: "Plus",
        subtitle: "Paid membership • 5 generations / week",
        features: ["Everything in Basic", "Calories (overview + filtering)", "Styles: Fit, Traditional, Exotic", "Higher generation limit"],
        note: "Payments and activation will be added in the next phase.",
      },
      subscribe: "Subscribe",
      manage: "Manage",
    },
    profile: { title: "Profile" },
  },

  uk: {
    nav: {
      generator: "Генератор",
      profile: "Профіль",
      pricing: "Ціни",
      login: "Увійти",
      logout: "Вийти",
    },
    pricing: {
      title: "Ціни",
      subtitle: "Плани та що вони містять. (Оплати додамо на наступному кроці.)",
      basic: {
        title: "Basic",
        subtitle: "Платне членство • 3 генерації / тиждень",
        features: ["Генерація меню + покупок", "Збережені плани в профілі", "Збережені налаштування", "Стилі: Дешево, Швидко, Збалансовано, Вегетаріанське"],
        note: "Калорії та стилі Fit/Traditional/Exotic будуть у Plus.",
      },
      plus: {
        title: "Plus",
        subtitle: "Платне членство • 5 генерацій / тиждень",
        features: ["Усе з Basic", "Калорії (огляд + фільтри)", "Стилі: Fit, Traditional, Exotic", "Вищий ліміт генерацій"],
        note: "Оплати та активацію додамо на наступній фазі.",
      },
      subscribe: "Підписатися",
      manage: "Керувати",
    },
    profile: { title: "Профіль" },
  },
};
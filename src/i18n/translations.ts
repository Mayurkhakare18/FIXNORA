export type Language = 'en' | 'hi' | 'mr';

export interface TranslationDictionary {
  nh: string;
  nf: string;
  nw: string;
  nr: string;
  na: string;
  np: string;
  lg: string;
  gs: string;
  lbl: string;
  h1: string;
  p: string;
  c1: string;
  c2: string;
  t1: string;
  t2: string;
  t3: string;
  fh: string;
  fp: string;
  hh: string;
  ph: string;
  ah: string;
  ch: string;
  cp: string;
  tag: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    nh: "Home",
    nf: "Features",
    nw: "How It Works",
    nr: "For Residents",
    na: "For Administrators",
    np: "Plans & Pricing",
    lg: "Login",
    gs: "Get Started",
    lbl: "SMART COMPLAINT MANAGEMENT",
    h1: "From Reporting Problems to Resolving Them.",
    p: "Report local issues, follow every update, and hold resolutions accountable — all from one simple platform.",
    c1: "Report an Issue",
    c2: "Explore Features",
    t1: "Multilingual Reporting",
    t2: "Transparent Tracking",
    t3: "Privacy-Conscious Access",
    fh: "Everything Needed to Resolve an Issue",
    fp: "From the first report to the final resolution, Fixnora keeps every step organized and visible to the right people.",
    hh: "A Clear Path from Complaint to Resolution",
    ph: "The Right Information. The Right People.",
    ah: "Resolve Today's Issues. Prevent Tomorrow's.",
    ch: "A Better Way to Get Things Resolved.",
    cp: "Make reporting simpler, follow progress with confidence, and help build more responsive communities.",
    tag: "Every Complaint Matters. Every Resolution Counts."
  },
  hi: {
    nh: "होम",
    nf: "सुविधाएँ",
    nw: "कैसे काम करता है",
    nr: "निवासियों के लिए",
    na: "प्रशासकों के लिए",
    np: "योजनाएं और मूल्य",
    lg: "लॉगिन",
    gs: "शुरू करें",
    lbl: "स्मार्ट शिकायत प्रबंधन",
    h1: "समस्या बताने से समाधान तक।",
    p: "स्थानीय समस्याएँ दर्ज करें, हर अपडेट देखें और समाधान की जवाबदेही तय करें — एक ही सरल प्लेटफ़ॉर्म पर।",
    c1: "समस्या दर्ज करें",
    c2: "सुविधाएँ देखें",
    t1: "बहुभाषी शिकायत",
    t2: "पारदर्शी ट्रैकिंग",
    t3: "गोपनीयता-सजग पहुँच",
    fh: "समस्या सुलझाने के लिए सब कुछ",
    fp: "पहली रिपोर्ट से अंतिम समाधान तक, Fixnora हर चरण को व्यवस्थित और सही लोगों को दिखाई देने योग्य रखता है।",
    hh: "शिकायत से समाधान तक का स्पष्ट रास्ता",
    ph: "सही जानकारी। सही लोग।",
    ah: "आज की समस्याएँ सुलझाएँ। कल की रोकें।",
    ch: "चीज़ें सुलझाने का बेहतर तरीका।",
    cp: "रिपोर्टिंग को सरल बनाएँ, भरोसे के साथ प्रगति देखें और अधिक संवेदनशील समुदाय बनाने में मदद करें।",
    tag: "हर शिकायत मायने रखती है। हर समाधान गिना जाता है।"
  },
  mr: {
    nh: "मुख्यपृष्ठ",
    nf: "वैशिष्ट्ये",
    nw: "हे कसे कार्य करते",
    nr: "रहिवाशांसाठी",
    na: "प्रशासकांसाठी",
    np: "प्लॅन आणि किंमत",
    lg: "लॉगिन",
    gs: "सुरुवात करा",
    lbl: "स्मार्ट तक्रार व्यवस्थापन",
    h1: "समस्या नोंदवण्यापासून निराकरणापर्यंत.",
    p: "स्थानिक समस्या नोंदवा, प्रत्येक अपडेट पाहा आणि निराकरणाची जवाबदारी निश्चित करा — एकाच सोप्या व्यासपीठावर.",
    c1: "समस्या नोंदवा",
    c2: "वैशिष्ट्ये पाहा",
    t1: "बहुभाषिक तक्रार",
    t2: "पारदर्शक ट्रॅकिंग",
    t3: "गोपनीयता-जागरूक प्रवेश",
    fh: "समस्या सोडवण्यासाठी सर्व काही",
    fp: "पहिल्या तक्रारीपासून अंतिम निराकरणापर्यंत, Fixnora प्रत्येक टप्पा संघटित आणि योग्य लोकांना दिसेल असा ठेवते.",
    hh: "तक्रारीपासून निराकरणापर्यंतचा स्पष्ट मार्ग",
    ph: "योग्य माहिती. योग्य लोक.",
    ah: "आजच्या समस्या सोडवा. उद्याच्या टाळा.",
    ch: "गोष्टी सोडवण्याचा उत्तम मार्ग.",
    cp: "तक्रार नोंदवणे सोपे करा, विश्वासाने प्रगती पाहा आणि अधिक प्रतिसादक्षम समुदाय घडवण्यास मदत करा.",
    tag: "प्रत्येक तक्रार महत्त्वाची. प्रत्येक निराकरण मोलाचे."
  }
};

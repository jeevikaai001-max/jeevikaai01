import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { SupportedLanguage } from '../types';

interface HelpFAQViewProps {
  initialTab?: 'faq' | 'accessibility' | 'privacy' | 'about';
  go: (route: string) => void;
  currentLang?: SupportedLanguage;
}

interface LocalizedFAQItem {
  q: string;
  a: string;
}

interface LocalizedCardItem {
  title: string;
  desc: string;
}

interface HelpFAQContent {
  headerAboutTitle: string;
  headerHelpTitle: string;
  headerAboutSubtitle: string;
  headerHelpSubtitle: string;
  tabs: {
    about: string;
    faq: string;
    accessibility: string;
    privacy: string;
  };
  faqs: LocalizedFAQItem[];
  accessibility: {
    heading: string;
    intro: string;
    cards: LocalizedCardItem[];
  };
  privacy: {
    heading: string;
    introBeforeStrong: string;
    introStrong: string;
    introAfterStrong: string;
    cards: LocalizedCardItem[];
  };
  about: {
    badge: string;
    heroTitle: string;
    heroDescBeforeBrand: string;
    brandName: string;
    heroDescAfterBrand: string;
    challengeTitle: string;
    challengeDesc: string;
    solutionTitle: string;
    solutionDesc: string;
    innovationsTitle: string;
    innovations: LocalizedCardItem[];
    footerTitle: string;
    footerSubtitle: string;
    ctaButton: string;
  };
}

const CONTENT_BY_LANG: Record<SupportedLanguage, HelpFAQContent> = {
  hi: {
    headerAboutTitle: 'JeevikaAI के बारे में',
    headerHelpTitle: 'सहायता, सुलभता और गोपनीयता नीतियाँ',
    headerAboutSubtitle:
      'आवाज़-आधारित आजीविका खोज मंच के पीछे हमारा दृष्टिकोण, उद्देश्य और टीम।',
    headerHelpSubtitle:
      'हमारी वॉयस तकनीक, सुलभता मानकों और डेटा सुरक्षा अधिकारों से जुड़ी पूरी जानकारी।',
    tabs: {
      about: 'हमारे बारे में',
      faq: 'अक्सर पूछे जाने वाले प्रश्न',
      accessibility: 'सुलभता मानक',
      privacy: 'गोपनीयता एवं डेटा अधिकार',
    },
    faqs: [
      {
        q: 'स्वचालित वॉयस संवाद कैसे काम करता है?',
        a: 'जब आप "बोलकर शुरू करें" पर टैप करते हैं, तो JeevikaAI बोलकर प्रश्न सुनाता है। आप हिंदी, भोजपुरी, अंग्रेजी या हिंग्लिश में अपना उत्तर बोल सकते हैं। बोलना रुकते ही सिस्टम अपने आप आपकी आवाज़ पहचानता है, आपके हुनर और पसंद को समझता है और बिना मैन्युअल क्लिक के अगले प्रश्न पर बढ़ जाता है।',
      },
      {
        q: 'क्या JeevikaAI कोई आधिकारिक सरकारी पोर्टल है?',
        a: 'नहीं। JeevikaAI एक स्वतंत्र, गैर-व्यावसायिक जन-हित मंच है। यद्यपि इसके प्रशिक्षण मार्ग राष्ट्रीय कौशल योग्यता ढाँचे (NSQF) के मानकों के अनुरूप हैं, लेकिन यह किसी सरकारी मंत्रालय द्वारा संचालित, संबद्ध या समर्थित नहीं है। यह सेवा पूरी तरह निशुल्क है। हमारी टीम के बारे में जानने के लिए "हमारे बारे में" टैब देखें।',
      },
      {
        q: 'NSQF स्तर क्या होता है?',
        a: 'राष्ट्रीय कौशल योग्यता ढाँचा (NSQF) ज्ञान, कौशल और योग्यता के आधार पर प्रशिक्षण को स्तर 1 से 10 तक श्रेणीबद्ध करता है। उदाहरण के लिए, स्तर 3 शुरुआती सेवा सहायक और ऑपरेटर के लिए है, जबकि स्तर 4 कुशल तकनीशियन को दर्शाता है।',
      },
      {
        q: 'अगर मेरे फोन का माइक्रोफोन काम न करे या ब्लॉक हो तो क्या करें?',
        a: 'JeevikaAI में पूरा टेक्स्ट विकल्प भी उपलब्ध है। मूल्यांकन के दौरान किसी भी समय आप "लिखकर जारी रखें" चुनकर विकल्पों पर टैप कर सकते हैं या कीबोर्ड से सीधे उत्तर लिख सकते हैं।',
      },
      {
        q: 'क्या मैं भोजपुरी या क्षेत्रीय हिंदी बोली में बात कर सकता हूँ?',
        a: 'जी हाँ। JeevikaAI में भोजपुरी और क्षेत्रीय बोलियों की विशेष शब्दावली जोड़ी गई है (जैसे: "रउआ नाम का बा?", "हमरा सिलाई सीखे के बा")। यदि ब्राउज़र आवाज़ को मानक हिंदी में लिखता है, तो स्क्रीन पर पहचाना गया पाठ दिखता है जिसे आप आसानी से जाँच या सुधार सकते हैं।',
      },
      {
        q: 'मैं अपने रोडमैप का सारांश कैसे डाउनलोड या शेयर करूँ?',
        a: 'अपने डैशबोर्ड पर "सारांश डाउनलोड करें" बटन दबाएँ। आप सारांश को PDF या टेक्स्ट फ़ाइल के रूप में सहेज सकते हैं, या व्हाट्सएप पर कॉपी करके परिवार, प्रशिक्षक या पंचायत समन्वयक के साथ साझा कर सकते हैं।',
      },
    ],
    accessibility: {
      heading: 'समावेशी डिज़ाइन प्रतिबद्धताएँ',
      intro:
        'JeevikaAI को विशेष रूप से कम पढ़े-लिखे नागरिकों, वरिष्ठ जनों और ग्रामीण स्मार्टफोन उपयोगकर्ताओं के लिए डिज़ाइन किया गया है ताकि डिजिटल बाधाएँ दूर हों।',
      cards: [
        {
          title: 'वॉयस-फर्स्ट संचालन',
          desc: 'जटिल मेनू या लंबे फॉर्म पढ़े बिना हर मुख्य सुविधा का उपयोग केवल बोलकर किया जा सकता है।',
        },
        {
          title: 'ऑडियो पाठ सुविधा',
          desc: 'सभी प्रश्न, अपडेट और रोडमैप सारांश स्पीकर बटन के साथ आते हैं ताकि बिना पढ़े भी हिंदी या भोजपुरी में सुना जा सके।',
        },
        {
          title: 'उच्च कंट्रास्ट और बड़े बटन',
          desc: 'हर बटन कम से कम 44x44 पिक्सल आकार का है और आसान पठनीयता के लिए WCAG AA कंट्रास्ट मानकों (न्यूनतम 4.5:1) का पालन करता है।',
        },
        {
          title: 'कीबोर्ड नेविगेशन और स्क्रीन रीडर सपोर्ट',
          desc: 'सहायक स्क्रीन रीडर्स के लिए स्पष्ट फोकस इंडिकेटर और लाइव ARIA घोषणाएँ उपलब्ध हैं।',
        },
      ],
    },
    privacy: {
      heading: 'पारदर्शी डेटा सिद्धांत',
      introBeforeStrong: 'हम सख्ती से ',
      introStrong: 'न्यूनतम डेटा संग्रह',
      introAfterStrong: ' और सूचित सहमति के सिद्धांतों का पालन करते हैं:',
      cards: [
        {
          title: 'हम क्या जानकारी एकत्र करते हैं',
          desc: 'केवल आपकी शिक्षा का स्तर, मौजूदा हुनर, कार्य में रुचि, पसंदीदा काम का प्रकार और यात्रा की दूरी। हम कभी भी आधार नंबर, बैंक पासवर्ड या संवेदनशील वित्तीय जानकारी नहीं मांगते।',
        },
        {
          title: 'लोकल स्टोरेज बनाम क्लाउड स्टोरेज',
          desc: 'डिफ़ॉल्ट रूप से आपकी प्रोफ़ाइल आपके ब्राउज़र या मोबाइल में सुरक्षित रहती है। यदि आप खाता बनाते हैं, तो डेटा सुरक्षित नियमों के तहत आपके निजी खाते में सुरक्षित रखा जाता है।',
        },
        {
          title: 'डेटा मिटाने और हटाने का अधिकार',
          desc: 'आप किसी भी समय अपनी प्रोफ़ाइल पेज से एक टैप में सभी सहेजे गए उत्तर मिटा सकते हैं या लॉगआउट कर सकते हैं।',
        },
      ],
    },
    about: {
      badge: 'टीम नाइट कोडर्स · आजीविका खोज पहल',
      heroTitle: 'वॉयस-फर्स्ट एआई से भारत की डिजिटल दूरी को पाटना',
      heroDescBeforeBrand: 'JeevikaAI की परिकल्पना और निर्माण ',
      brandName: 'टीम नाइट कोडर्स',
      heroDescAfterBrand:
        ' द्वारा एक खुली नागरिक नवाचार पहल के रूप में किया गया है। हमारा उद्देश्य हिंदी, भोजपुरी, अंग्रेजी और हिंग्लिश में सहज बातचीत के जरिए करोड़ों प्रथम-बार डिजिटल उपयोगकर्ताओं तक NSQF-संरेखित कौशल और रोजगार के अवसर पहुँचाना है।',
      challengeTitle: 'मुख्य चुनौती',
      challengeDesc:
        'अर्ध-शहरी और ग्रामीण भारत के 30 करोड़ से अधिक नागरिकों को कौशल प्रशिक्षण या स्थानीय नौकरी खोजते समय भाषा की बाधा, जटिल ऑनलाइन फॉर्म और कठिन सरकारी शब्दावली का सामना करना पड़ता है।',
      solutionTitle: 'हमारा समाधान',
      solutionDesc:
        'JeevikaAI जटिल ड्रॉपडाउन और फॉर्म की जगह एक सरल वॉयस संवाद प्रदान करता है। उपयोगकर्ता केवल बोलकर अपनी शिक्षा और रुचि बताते हैं, और सिस्टम स्वतः उन्हें मान्यता प्राप्त NSQF मार्गों व स्थानीय अवसरों से जोड़ देता है।',
      innovationsTitle: 'JeevikaAI के लिए निर्मित प्रमुख तकनीकी नवाचार',
      innovations: [
        {
          title: 'वॉयस-फर्स्ट टर्न इंजन',
          desc: 'बोलना समाप्त होते ही स्वतः पहचान, ऑडियो फ़्रीक्वेंसी विज़ुअलाइज़र और बिना किसी अतिरिक्त बटन दबाए स्वचालित प्रगति।',
        },
        {
          title: 'बोली और भारतीय भाषा समर्थन',
          desc: 'भोजपुरी और बोलचाल की हिंदी के लिए विशेष शब्दावली मॉडल, जो क्षेत्रीय शब्दों और पेशों को सटीक समझते हैं।',
        },
        {
          title: 'इंस्टॉल होने योग्य ऑफ़लाइन PWA ऐप',
          desc: 'बजट एंड्रॉइड फोन पर सीधे इंस्टॉल होने वाला प्रोग्रेसिव वेब ऐप, जो कम या बिना इंटरनेट में भी सहेजा डेटा दिखाता है।',
        },
      ],
      footerTitle: 'टीम नाइट कोडर्स द्वारा समर्पण के साथ निर्मित',
      footerSubtitle: 'सशक्तिकरण और आजीविका खोज के लिए खुली नागरिक तकनीक।',
      ctaButton: 'अभी वॉयस मूल्यांकन आज़माएँ',
    },
  },

  bho: {
    headerAboutTitle: 'JeevikaAI के बारे में',
    headerHelpTitle: 'मदद, सुलभता अउर गोपनीयता नीति',
    headerAboutSubtitle:
      'आवाज से आजीविका खोजे वाला एह मंच के सोच, मकसद अउर टीम के जानकारी।',
    headerHelpSubtitle:
      'हमनी के वॉयस तकनीक, सुलभता मानक अउर डेटा सुरक्षा अधिकार से जुड़ल सब जरूरी जानकारी।',
    tabs: {
      about: 'हमरा बारे में',
      faq: 'अक्सर पूछल जाए वाला सवाल',
      accessibility: 'सुलभता मानक',
      privacy: 'गोपनीयता अउर डेटा अधिकार',
    },
    faqs: [
      {
        q: 'अपने आप बोले वाला वॉयस संवाद कइसे काम करेला?',
        a: 'जब रउआ "बोल के शुरू करीं" पर दबाईं त JeevikaAI बोल के सवाल सुनावेला। रउआ हिंदी, भोजपुरी, अंग्रेजी या हिंग्लिश में जवाब बोल सकत बानी। रउआ चुप होते ही सिस्टम अपने आप रउआ आवाज पहचान लेला, रउआ हुनर अउर पसंद समझ लेला अउर बिना बटन दबवले अगले सवाल पर चल जाला।',
      },
      {
        q: 'का JeevikaAI कवनो सरकारी पोर्टल ह?',
        a: 'ना। JeevikaAI एगो स्वतंत्र अउर निशुल्क जन-हित मंच ह। हमनी के ट्रेनिंग रास्ता NSQF मानक के हिसाब से बा, बाकी ई कवनो सरकारी मंत्रालय से जुड़ल या संचालित नइखे। एह पर कवनो पैसा ना लागेला। हमनी के टीम के बारे में जाने खातिर "हमरा बारे में" टैब देखीं।',
      },
      {
        q: 'NSQF स्तर का होला?',
        a: 'राष्ट्रीय कौशल योग्यता ढाँचा (NSQF) ज्ञान अउर हुनर के हिसाब से ट्रेनिंग के लेवल 1 से 10 तक बांटेला। जइसे लेवल 3 शुरुआती सहायक अउर ऑपरेटर खातिर ह, अउर लेवल 4 कुशल तकनीशियन खातिर होला।',
      },
      {
        q: 'अगर हमरा फोन के माइक काम ना करे या बंद होखे त का करीं?',
        a: 'JeevikaAI में पूरा लिख के जवाब देवे के विकल्प बा। रउआ मूल्यांकन के बीच में कभी भी "लिख के आगे बढ़ीं" चुन के विकल्प दबा सकत बानी या कीबोर्ड से टाइप कर सकत बानी।',
      },
      {
        q: 'का हम भोजपुरी या अपना गाँव के बोली में बोल सकत बानी?',
        a: 'हाँ बिल्कुल। JeevikaAI में भोजपुरी के खास शब्द जोड़ल बा (जइसे: "रउआ नाम का बा?", "हमरा सिलाई सीखे के बा")। अगर ब्राउज़र रउआ बात के हिंदी में लिखे त स्क्रीन पर लिखल दिखेला जेकरा के रउआ आराम से सुधार सकत बानी।',
      },
      {
        q: 'हम अपना रोडमैप के सारांश कइसे डाउनलोड या शेयर करीं?',
        a: 'रउआ डैशबोर्ड पर "सारांश डाउनलोड करीं" बटन दबाईं। रउआ एकरा के PDF या टेक्स्ट फाइल में सेव कर सकत बानी, या व्हाट्सएप पर कॉपी करके परिवार, ट्रेनर या पंचायत साथी के भेज सकत बानी।',
      },
    ],
    accessibility: {
      heading: 'सबका खातिर आसान डिज़ाइन प्रतिबद्धता',
      intro:
        'JeevikaAI खास तौर पर कम पढ़ल-लिखल लोग, बुजुर्ग अउर गाँव के स्मार्टफोन चलावे वाला नागरिक खातिर बनावल गइल बा ताकि डिजिटल दिक्कत दूर होखे।',
      cards: [
        {
          title: 'बोल के चलावे के सुविधा',
          desc: 'मुश्किल मेनू या लंबा फॉर्म पढ़ले बिना खाली बोल के हर जरूरी काम कइल जा सकेला।',
        },
        {
          title: 'आवाज में सुनला के सुविधा',
          desc: 'हर सवाल, अपडेट अउर रोडमैप के आगे स्पीकर बटन बा ताकि पढ़ले बिना भी हिंदी या भोजपुरी में सुनल जा सके।',
        },
        {
          title: 'साफ रंग अउर बड़ा बटन',
          desc: 'हर बटन कम से कम 44x44 पिक्सल के बड़ा साइज में बा अउर साफ पढ़े खातिर WCAG AA रंग मानक के पालन करेला।',
        },
        {
          title: 'कीबोर्ड अउर स्क्रीन रीडर मदद',
          desc: 'कीबोर्ड से चलावे अउर स्क्रीन रीडर इस्तेमाल करे वाला खातिर साफ फोकस अउर लाइव ARIA सूचना दिहल गइल बा।',
        },
      ],
    },
    privacy: {
      heading: 'साफ अउर पारदर्शी डेटा नियम',
      introBeforeStrong: 'हमनी के पूरी ईमानदारी से ',
      introStrong: 'जरूरी से कम डेटा संग्रह',
      introAfterStrong: ' अउर रउआ मंजूरी के नियम मानत बानी:',
      cards: [
        {
          title: 'हमनी के का जानकारी लीला',
          desc: 'खाली रउआ पढ़ाई, मौजूदा हुनर, काम के पसंद अउर यात्रा के दूरी। हमनी के कभी भी आधार नंबर, बैंक पासवर्ड या पैसा-कौड़ी के निजी जानकारी ना मांगीला।',
        },
        {
          title: 'फोन में सेव बनाम क्लाउड स्टोरेज',
          desc: 'शुरुआत में रउआ प्रोफ़ाइल रउआ अपने फोन या ब्राउज़र में सुरक्षित रहेला। अगर रउआ खाता बनाईं त डेटा सुरक्षित नियम के तहत रउआ निजी खाता में सुरक्षित रहेला।',
        },
        {
          title: 'डेटा मिटावे अउर हटावे के अधिकार',
          desc: 'रउआ कभी भी अपना प्रोफ़ाइल पेज पर जाके एक क्लिक में सब सहेजल जानकारी मिटा सकत बानी या लॉगआउट कर सकत बानी।',
        },
      ],
    },
    about: {
      badge: 'टीम नाइट कोडर्स · आजीविका खोज पहल',
      heroTitle: 'बोल के चले वाला एआई से भारत के डिजिटल दूरी मिटावल',
      heroDescBeforeBrand: 'JeevikaAI के सोच अउर निर्माण ',
      brandName: 'टीम नाइट कोडर्स',
      heroDescAfterBrand:
        ' द्वारा एगो खुली जन-सेवा पहल के रूप में कइल गइल बा। हमनी के मकसद हिंदी, भोजपुरी, अंग्रेजी अउर हिंग्लिश में आसान बातचीत से करोड़ों लोग तक NSQF ट्रेनिंग अउर रोजगार के मौका पहुँचावल ह।',
      challengeTitle: 'बड़ चुनौती',
      challengeDesc:
        'गाँव अउर कस्बा के 30 करोड़ से अधिक लोग के ट्रेनिंग या काम खोजते समय भाषा के दिक्कत, लंबा ऑनलाइन फॉर्म अउर मुश्किल सरकारी शब्द के वजह से परेशानी होखेला।',
      solutionTitle: 'हमनी के समाधान',
      solutionDesc:
        'JeevikaAI मुश्किल फॉर्म के जगह बोल के बात करे वाला सिस्टम देवेला। रउआ बस बोल के आपन पढ़ाई अउर पसंद बताईं, अउर ई अपने आप रउआ खातिर सही NSQF ट्रेनिंग अउर पास के रोजगार दिखा दिही।',
      innovationsTitle: 'JeevikaAI खातिर बनावल मुख्य तकनीक',
      innovations: [
        {
          title: 'बोल के आगे बढ़े वाला इंजन',
          desc: 'बात खतम होते ही आवाज पहचान, लाइव वेव विज़ुअलाइज़र अउर बिना अलग से बटन दबवले अपने आप आगे बढ़े वाला सुविधा।',
        },
        {
          title: 'भोजपुरी अउर क्षेत्रीय बोली सपोर्ट',
          desc: 'भोजपुरी अउर बोलचाल के हिंदी खातिर खास शब्द मॉडल, जवन गाँव-देहात के कामकाज अउर पेशा के सही से समझेला।',
        },
        {
          title: 'ऑफ़लाइन चले वाला PWA ऐप',
          desc: 'सस्ता एंड्रॉइड फोन में सीधे इंस्टॉल होखे वाला ऐप, जवन कमजोर इंटरनेट या बिना नेटवर्क में भी सहेजल डेटा देखावेला।',
        },
      ],
      footerTitle: 'टीम नाइट कोडर्स द्वारा लगन से बनावल',
      footerSubtitle: 'आत्मनिर्भरता अउर आजीविका खोज खातिर खुली नागरिक तकनीक।',
      ctaButton: 'अभी वॉयस मूल्यांकन आजमाईं',
    },
  },

  en: {
    headerAboutTitle: 'About JeevikaAI',
    headerHelpTitle: 'Help, Accessibility & Privacy',
    headerAboutSubtitle:
      'The vision, origins, and team behind the voice-first livelihood discovery platform.',
    headerHelpSubtitle:
      'Everything you need to know about our voice technology, accessibility commitments, and data rights.',
    tabs: {
      about: 'About Us',
      faq: 'Frequently Asked Questions (FAQ)',
      accessibility: 'Accessibility Standards',
      privacy: 'Privacy & Data Rights',
    },
    faqs: [
      {
        q: 'How does the automatic voice conversation work?',
        a: 'When you tap Start Assessment, JeevikaAI speaks a question aloud using text-to-speech. You speak your answer in Hindi, Bhojpuri, English, or Hinglish. As soon as you stop speaking, the system automatically recognizes your speech, extracts your skills or preferences, and advances to the next question without requiring manual clicks.',
      },
      {
        q: 'Is JeevikaAI an official government portal?',
        a: 'No. JeevikaAI is an independent, non-commercial public-interest platform. While training pathways are aligned with the National Skills Qualifications Framework (NSQF) standards, JeevikaAI is not operated by, affiliated with, or endorsed by any government ministry. It is free to use and never charges beneficiaries. To learn more about our team and background, visit the About Us tab.',
      },
      {
        q: 'What is an NSQF Level?',
        a: 'The National Skills Qualifications Framework (NSQF) organizes qualifications according to levels of knowledge, skills, and aptitude from Level 1 to 10. For example, Level 3 covers entry-level service assistants and operators, while Level 4 represents skilled technicians.',
      },
      {
        q: 'What if my microphone is not supported or blocked?',
        a: 'JeevikaAI provides a full text alternative. You can tap "Continue with Text" at any point during the assessment to select options or type answers directly.',
      },
      {
        q: 'Can I speak in Bhojpuri or regional Hindi dialects?',
        a: 'Yes. JeevikaAI includes Bhojpuri vocabulary mappings (such as "Raua naam ka ba?" or "Hamra silai seekhe ke ba"). If your browser speech recognition interprets words in standard Hindi, the platform displays the recognized text so you can confirm or correct it.',
      },
      {
        q: 'How do I download or share my roadmap summary?',
        a: 'On your dashboard, tap "Download Summary". You can save the summary as a PDF or text (.txt) file, or copy it to WhatsApp to share with a family member, trainer, or Panchayat coordinator.',
      },
    ],
    accessibility: {
      heading: 'Inclusive Design Commitments',
      intro:
        'JeevikaAI is engineered specifically for individuals with limited literacy, older adults, and rural smartphone users who face digital barriers.',
      cards: [
        {
          title: 'Voice-First Operability',
          desc: 'Every core feature can be driven through speech without requiring reading complex menus or forms.',
        },
        {
          title: 'Auditory Readouts (Text-to-Speech)',
          desc: 'Questions, status updates, and roadmap summaries are equipped with speaker buttons so non-readers can listen in Hindi or Bhojpuri.',
        },
        {
          title: 'High Contrast & Large Hitboxes',
          desc: 'Every interactive touch target is sized to at least 44x44px with WCAG AA compliant contrast ratios (minimum 4.5:1 for body copy).',
        },
        {
          title: 'Keyboard Navigation & Screen Readers',
          desc: 'Full focus indicators and ARIA live regions provide real-time status announcements for assistive screen readers.',
        },
      ],
    },
    privacy: {
      heading: 'Transparent Data Principles',
      introBeforeStrong: 'We adhere strictly to the principle of ',
      introStrong: 'Data Minimization',
      introAfterStrong: ' and informed consent:',
      cards: [
        {
          title: 'What We Collect',
          desc: 'Only education level, existing skills, career interests, preferred work type, and general travel mobility radius. We do not ask for Aadhaar numbers, bank passwords, or sensitive financial data.',
        },
        {
          title: 'Local Storage vs Cloud Storage',
          desc: 'By default, your profile is stored locally inside your browser or mobile phone memory. If you choose to create an account, data is stored securely in your private user document protected by Firebase Security Rules.',
        },
        {
          title: 'Right to Erase & Delete',
          desc: 'You can erase all locally stored answers or sign out anytime from your Profile page with one tap.',
        },
      ],
    },
    about: {
      badge: 'Team Knight Coders · Livelihood Discovery Initiative',
      heroTitle: "Bridging India's Digital Divide Through Voice-First AI",
      heroDescBeforeBrand: 'JeevikaAI was conceptualized and developed by ',
      brandName: 'Team Knight Coders',
      heroDescAfterBrand:
        ' as an open civic innovation project. Our mission is to make NSQF-aligned vocational discovery and employment pathways accessible to millions of first-time digital users through conversational voice in Hindi, Bhojpuri, English, and Hinglish.',
      challengeTitle: 'The Challenge',
      challengeDesc:
        'Over 300 million citizens across semi-urban and rural India face language barriers, complex multi-page online forms, and unfamiliar bureaucratic terminology when seeking skill development programs or local employment opportunities.',
      solutionTitle: 'Our Solution',
      solutionDesc:
        'JeevikaAI replaces intimidating dropdowns and text inputs with a natural, guided voice conversation. Users simply speak about their education, interests, and preferences, and the system automatically matches them with government-recognized NSQF pathways and local vocational courses.',
      innovationsTitle: 'Key Architectural Innovations Built for JeevikaAI',
      innovations: [
        {
          title: 'Voice-First Turn Engine',
          desc: 'Autonomous speech recognition with end-of-speech stability detection, visual frequency analyzers, and zero manual "Next" button friction.',
        },
        {
          title: 'Dialect & Indic Support',
          desc: 'Tailored vocabulary models for Bhojpuri and conversational Hindi, supporting colloquial phrases and regional occupation titles.',
        },
        {
          title: 'Installable Offline PWA',
          desc: 'Progressive Web App architecture that installs directly on budget Android smartphones, cached for offline access and intermittent rural connectivity.',
        },
      ],
      footerTitle: 'Built with dedication by Team Knight Coders',
      footerSubtitle: 'Open civic technology for empowerment and livelihood discovery.',
      ctaButton: 'Try Voice Assessment Now',
    },
  },

  hin: {
    headerAboutTitle: 'JeevikaAI ke Baare Mein',
    headerHelpTitle: 'Help, Accessibility aur Privacy Policies',
    headerAboutSubtitle:
      'Voice-first livelihood discovery platform ke peeche hamara vision, mission aur team ki jaankari.',
    headerHelpSubtitle:
      'Hamari voice technology, accessibility standards aur data safety rights se judi poori jaankari.',
    tabs: {
      about: 'About Us (Hamare Baare Mein)',
      faq: 'Aksar Pooche Jaane Wale Sawaal (FAQ)',
      accessibility: 'Accessibility Standards',
      privacy: 'Privacy & Data Rights',
    },
    faqs: [
      {
        q: 'Automatic voice conversation kaise kaam karta hai?',
        a: 'Jab aap Start Assessment par tap karte hain, JeevikaAI text-to-speech se sawaal bolkar sunata hai. Aap Hindi, Bhojpuri, English ya Hinglish mein apna jawaab bol sakte hain. Bolna rukte hi system automatically aapki awaaz samajh leta hai, skills extract karta hai aur bina click ke agle sawaal par badh jaata hai.',
      },
      {
        q: 'Kya JeevikaAI ek official government portal hai?',
        a: 'Nahi. JeevikaAI ek independent, non-commercial public-interest platform hai. Training pathways NSQF standards se aligned hain, lekin yeh kisi government ministry dwara chalaya ya endorsed nahi hai. Yeh bilkul free hai. Hamari team ke baare mein jaanne ke liye "About Us" tab dekhein.',
      },
      {
        q: 'NSQF Level kya hota hai?',
        a: 'National Skills Qualifications Framework (NSQF) knowledge aur skills ke hisaab se training ko Level 1 se 10 tak divide karta hai. Jaise Level 3 entry-level assistant/operator ke liye hai, aur Level 4 skilled technician dikhata hai.',
      },
      {
        q: 'Agar mere phone ka microphone kaam na kare ya blocked ho toh kya karein?',
        a: 'JeevikaAI mein poora text option bhi available hai. Aap assessment ke kisi bhi step par "Continue with Text" tap karke options choose kar sakte hain ya keyboard se type kar sakte hain.',
      },
      {
        q: 'Kya main Bhojpuri ya regional Hindi dialect mein bol sakta hoon?',
        a: 'Haan bilkul. JeevikaAI mein Bhojpuri vocabulary mappings (jaise "Raua naam ka ba?", "Hamra silai seekhe ke ba") shaamil hain. Agar browser aapki baat standard Hindi mein likhe, toh screen par text dikhta hai jise aap confirm ya correct kar sakte hain.',
      },
      {
        q: 'Main apna roadmap summary kaise download ya share karoon?',
        a: 'Apne dashboard par "Download Summary" button dabayein. Aap summary ko PDF ya text (.txt) file mein save kar sakte hain, ya WhatsApp par copy karke family, trainer ya Panchayat coordinator ko bhej sakte hain.',
      },
    ],
    accessibility: {
      heading: 'Inclusive Design Commitments',
      intro:
        'JeevikaAI ko khaas taur par kam padhe-likhe users, senior citizens aur rural smartphone users ke liye banaya gaya hai taaki digital barriers khatam hon.',
      cards: [
        {
          title: 'Voice-First Operability',
          desc: 'Bina mushkil menu ya lambe form padhe, har zaroori feature sirf bolkar chalaya ja sakta hai.',
        },
        {
          title: 'Audio Readouts (Text-to-Speech)',
          desc: 'Har sawaal, update aur roadmap summary mein speaker button diya gaya hai taaki aap Hindi ya Bhojpuri mein sun sakein.',
        },
        {
          title: 'High Contrast aur Bade Buttons',
          desc: 'Har button kam se kam 44x44px size ka hai aur WCAG AA high contrast standards (4.5:1) follow karta hai.',
        },
        {
          title: 'Keyboard Navigation & Screen Readers',
          desc: 'Screen readers ke liye clear focus indicators aur ARIA live announcements diye gaye hain.',
        },
      ],
    },
    privacy: {
      heading: 'Transparent Data Principles',
      introBeforeStrong: 'Hum strictly ',
      introStrong: 'Data Minimization',
      introAfterStrong: ' aur informed consent ke rules follow karte hain:',
      cards: [
        {
          title: 'Hum Kya Collect Karte Hain',
          desc: 'Sirf education level, existing skills, career interests, work type aur travel range. Hum kabhi bhi Aadhaar number, bank password ya financial details nahi maangte.',
        },
        {
          title: 'Local Storage vs Cloud Storage',
          desc: 'By default aapki profile aapke browser ya phone memory mein safe rehti hai. Agar aap account banate hain, toh data Firebase Security Rules ke saath aapke private account mein store hota hai.',
        },
        {
          title: 'Right to Erase & Delete',
          desc: 'Aap kabhi bhi apne Profile page se ek tap mein saara saved data delete kar sakte hain ya logout kar sakte hain.',
        },
      ],
    },
    about: {
      badge: 'Team Knight Coders · Livelihood Discovery Initiative',
      heroTitle: 'Voice-First AI se India ka Digital Divide Door Karna',
      heroDescBeforeBrand: 'JeevikaAI ko ',
      brandName: 'Team Knight Coders',
      heroDescAfterBrand:
        ' ne ek open civic innovation project ke roop mein banaya hai. Hamara mission hai ki Hindi, Bhojpuri, English aur Hinglish mein aasaan voice baat-cheet ke zariye karodon first-time digital users ko NSQF training aur jobs se joda jaaye.',
      challengeTitle: 'Mukhya Chunauti (The Challenge)',
      challengeDesc:
        'Semi-urban aur rural India ke 30 crore se zyada logon ko skill training ya local job dhoondhte waqt language barrier, mushkil online forms aur kathin words ki dikkat aati hai.',
      solutionTitle: 'Hamara Samadhaan (Our Solution)',
      solutionDesc:
        'JeevikaAI mushkil dropdowns aur forms ki jagah ek natural voice conversation deta hai. Users bas apni education aur interest bolkar batate hain, aur system automatically unhe NSQF pathways aur local courses se match kar deta hai.',
      innovationsTitle: 'JeevikaAI ke Liye Banaye Gaye Key Innovations',
      innovations: [
        {
          title: 'Voice-First Turn Engine',
          desc: 'Bolna khatam hote hi auto speech recognition, frequency visualizer aur bina manual "Next" click ke smooth flow.',
        },
        {
          title: 'Dialect & Indic Support',
          desc: 'Bhojpuri aur bol-chaal ki Hindi ke liye special vocabulary models jo local kaam aur professions ko sahi samajhte hain.',
        },
        {
          title: 'Installable Offline PWA',
          desc: 'Budget Android smartphones par seedha install hone wala PWA app jo low ya no internet mein bhi saved data dikhata hai.',
        },
      ],
      footerTitle: 'Team Knight Coders dwara dedication ke saath nirmit',
      footerSubtitle: 'Empowerment aur livelihood discovery ke liye open civic technology.',
      ctaButton: 'Abhi Voice Assessment Try Karein',
    },
  },
};

export const HelpFAQView: React.FC<HelpFAQViewProps> = ({
  initialTab = 'faq',
  go,
  currentLang = 'hi',
}) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'accessibility' | 'privacy' | 'about'>(initialTab);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const c = CONTENT_BY_LANG[currentLang] || CONTENT_BY_LANG.hi;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#DCE3EA] mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
          {activeTab === 'about' ? c.headerAboutTitle : c.headerHelpTitle}
        </h1>
        <p className="text-sm text-[#5F6B76] mt-1">
          {activeTab === 'about' ? c.headerAboutSubtitle : c.headerHelpSubtitle}
        </p>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-bold">
          {[
            { id: 'about', label: c.tabs.about },
            { id: 'faq', label: c.tabs.faq },
            { id: 'accessibility', label: c.tabs.accessibility },
            { id: 'privacy', label: c.tabs.privacy },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'faq' | 'accessibility' | 'privacy' | 'about')}
              className={`min-h-[44px] px-4 py-2 rounded-xl transition-colors border ${
                activeTab === tab.id
                  ? 'bg-[#17365D] text-white border-[#17365D]'
                  : 'bg-[#F7F9FC] text-[#5F6B76] border-[#DCE3EA] hover:border-[#245A91] hover:text-[#17365D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: FAQ Accordion */}
      {activeTab === 'faq' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-3.5">
          {c.faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-[#DCE3EA] rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full min-h-[48px] p-4 text-left font-bold text-sm text-[#17365D] flex items-center justify-between gap-4 bg-[#F7F9FC] hover:bg-slate-100 transition-colors"
              >
                <span>{faq.q}</span>
                <Icon
                  name="chev"
                  size={14}
                  className={`flex-shrink-0 transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === i && (
                <div className="p-4 text-xs sm:text-sm text-[#5F6B76] leading-relaxed bg-white border-t border-[#DCE3EA]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Accessibility Information */}
      {activeTab === 'accessibility' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-5 text-xs sm:text-sm text-[#5F6B76] leading-relaxed">
          <div className="flex items-center gap-2 text-[#287D73] font-bold text-base">
            <Icon name="check" size={18} />
            <span>{c.accessibility.heading}</span>
          </div>
          <p>{c.accessibility.intro}</p>
          <div className="space-y-3">
            {c.accessibility.cards.map((card, idx) => (
              <div key={idx} className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
                <h4 className="font-bold text-[#17365D] mb-1">{card.title}</h4>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Privacy & Data Rights */}
      {activeTab === 'privacy' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-5 text-xs sm:text-sm text-[#5F6B76] leading-relaxed">
          <div className="flex items-center gap-2 text-[#17365D] font-bold text-base">
            <Icon name="info" size={18} className="text-[#245A91]" />
            <span>{c.privacy.heading}</span>
          </div>
          <p>
            {c.privacy.introBeforeStrong}
            <strong>{c.privacy.introStrong}</strong>
            {c.privacy.introAfterStrong}
          </p>
          <div className="space-y-3">
            {c.privacy.cards.map((card, idx) => (
              <div key={idx} className="p-4 bg-[#F7F9FC] rounded-xl border border-[#DCE3EA]">
                <h4 className="font-bold text-[#17365D] mb-1">{card.title}</h4>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: About Us & Team Knight Coders Initiative */}
      {activeTab === 'about' && (
        <div className="bg-white border border-[#DCE3EA] rounded-2xl p-6 sm:p-8 space-y-7">
          <div className="bg-[#17365D] text-white rounded-2xl p-6 sm:p-8">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#F4B966] mb-2">
              {c.about.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
              {c.about.heroTitle}
            </h2>
            <p className="mt-3 text-sm text-[#C9DAEC] max-w-2xl leading-relaxed">
              {c.about.heroDescBeforeBrand}
              <strong>{c.about.brandName}</strong>
              {c.about.heroDescAfterBrand}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm text-[#5F6B76]">
            <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#17365D] font-bold text-base">
                <Icon name="target" size={18} className="text-[#245A91]" />
                <span>{c.about.challengeTitle}</span>
              </div>
              <p className="leading-relaxed">{c.about.challengeDesc}</p>
            </div>

            <div className="bg-[#F7F9FC] border border-[#DCE3EA] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#287D73] font-bold text-base">
                <Icon name="check" size={18} className="text-[#287D73]" />
                <span>{c.about.solutionTitle}</span>
              </div>
              <p className="leading-relaxed">{c.about.solutionDesc}</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#17365D]">
              {c.about.innovationsTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {c.about.innovations.map((item, idx) => {
                const badgeStyles = [
                  { bg: 'bg-[#EBF3FB] text-[#245A91]', icon: 'mic' },
                  { bg: 'bg-[#E9F4F2] text-[#287D73]', icon: 'globe' },
                  { bg: 'bg-[#FFF4DB] text-[#D9822B]', icon: 'device' },
                ][idx] || { bg: 'bg-[#EBF3FB] text-[#245A91]', icon: 'mic' };

                return (
                  <div key={idx} className="border border-[#DCE3EA] rounded-xl p-4 space-y-2 bg-white">
                    <div className={`w-9 h-9 rounded-lg ${badgeStyles.bg} flex items-center justify-center`}>
                      <Icon name={badgeStyles.icon} size={18} />
                    </div>
                    <h4 className="font-bold text-[#17365D] text-sm">{item.title}</h4>
                    <p className="text-[#5F6B76] leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#DCE3EA] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-[#17365D]">
                {c.about.footerTitle}
              </h4>
              <p className="text-xs text-[#5F6B76] mt-0.5">
                {c.about.footerSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => go('assessment')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <span>{c.about.ctaButton}</span>
              <Icon name="arrowR" size={14} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

/* Workflow page data: every step of a project, by role (English and Arabic) */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  /* lane: brand | platform | supplier | ops · row: position top to bottom · side: optional task */
  const S = (id, lane, row, num, href, en, ar, extra) => Object.assign({ id, lane, row, num, href, en, ar }, extra || {});
  const steps = [
    S('p1', 'ops', 1, null, 'o-verify',
      { title: 'Verify supplier', sub: 'licence document review', does: 'Operations opens the trade licence document, checks name and number against the profile, records the expiry date, then approves, rejects or asks for more. A file name alone is never accepted.', screen: 'Operations › Verification', result: 'A “Business licence reviewed” label with an expiry date, shown as evidence next to each match.' },
      { title: 'توثيق المورد', sub: 'مراجعة مستند الرخصة', does: 'تفتح العمليات مستند الرخصة التجارية، وتطابق الاسم والرقم مع الملف، وتسجل تاريخ الانتهاء، ثم تعتمد أو ترفض أو تطلب معلومات. لا يكفي اسم الملف وحده أبداً.', screen: 'العمليات › التوثيق', result: 'علامة «تمت مراجعة الرخصة التجارية» مع تاريخ انتهاء، تُعرض كدليل بجانب كل مطابقة.' }, { pre: true }),
    S('p2', 'supplier', 1, null, 's-listings',
      { title: 'List opportunity', sub: 'price, schedule, capacity', does: 'The supplier adds each opportunity in English and Arabic with price, operating days, capacity per date, access rules, facilities, accepted categories and dated evidence, or imports a spreadsheet.', screen: 'Supplier › Listings', result: 'The listing is visible to brands in plans and the catalogue.' },
      { title: 'إدراج فرصة', sub: 'السعر والجدول والسعة', does: 'يضيف المورد كل فرصة بالعربية والإنجليزية مع السعر وأيام التشغيل والسعة لكل تاريخ وقواعد الدخول والمرافق والفئات المقبولة وأدلة مؤرخة، أو يستورد جدولاً.', screen: 'المورد › الفرص المدرجة', result: 'تظهر الفرصة للعلامات في الخطط والكتالوج.' }, { pre: true }),
    S('s1', 'brand', 3, 1, 'c-new',
      { title: 'Set objective', sub: 'goal, budget, dates', does: 'The brand answers seven plain questions, or types one sentence that the platform reads with fixed rules and shows back for confirmation. Typed values are never overwritten, and drafts are kept.', screen: 'Brand › New objective', result: 'A saved objective with required and preferred settings.' },
      { title: 'تحديد الهدف', sub: 'الهدف والميزانية والتواريخ', does: 'تجيب العلامة عن سبعة أسئلة بسيطة، أو تكتب جملة واحدة تقرؤها المنصة بقواعد ثابتة وتعرضها للتأكيد. لا تُستبدل القيم المكتوبة أبداً، وتُحفظ المسودات.', screen: 'العلامة › هدف جديد', result: 'هدف محفوظ مع إعدادات إلزامية ومفضلة.' }),
    S('s2', 'platform', 4, 2, 'c-plans',
      { title: 'Rank matches', sub: 'checks first, then 6 factors', does: 'The platform first checks every requirement and excludes listings that cannot meet one, then scores the rest on six visible preferences, explains each match and builds packages within the budget.', screen: 'Brand › Objectives & plans', result: 'A ranked plan with reasons, costs, risks and alternatives.' },
      { title: 'ترتيب الفرص', sub: 'الفحص أولاً ثم ٦ عوامل', does: 'تفحص المنصة أولاً كل متطلب وتستبعد القوائم التي لا تستوفيه، ثم تقيّم البقية وفق ست أفضليات ظاهرة، وتشرح كل مطابقة، وتبني حزماً ضمن الميزانية.', screen: 'العلامة › الأهداف والخطط', result: 'خطة مرتبة مع الأسباب والتكاليف والمخاطر والبدائل.' }),
    S('s3', 'brand', 5, 3, 'c-compare',
      { title: 'Compare, select', sub: 'up to 4 side by side', does: 'The brand compares opportunities on the same factors and selects the ones it wants offers for.', screen: 'Brand › Compare', result: 'A final selection for the RFQ.' },
      { title: 'المقارنة والاختيار', sub: 'حتى ٤ جنباً إلى جنب', does: 'تقارن العلامة الفرص بالعوامل نفسها وتختار ما تريد عروضاً له.', screen: 'العلامة › المقارنة', result: 'اختيار نهائي لطلب العروض.' }),
    S('s4', 'platform', 6, 4, 'c-rfqs',
      { title: 'Send one RFQ', sub: 'to every supplier', does: 'One standard request for quotation goes to every selected supplier, with dates, audience, reporting level and reply date.', screen: 'Brand › RFQs & offers', result: 'RFQ status: Open.' },
      { title: 'إرسال طلب عروض واحد', sub: 'لكل الموردين', does: 'يُرسل طلب عروض أسعار موحد لكل مورد مختار، مع التواريخ والجمهور ومستوى التقارير وموعد الرد.', screen: 'العلامة › طلبات العروض والعروض', result: 'حالة الطلب: مفتوح.' }),
    S('s5', 'supplier', 7, 5, 's-rfqs',
      { title: 'Reply to RFQ', sub: 'offer or decline', does: 'Each supplier answers in the same form: price, setup fee, units, dates, deliverables, reporting, terms and validity, or declines with a reason. Each revision becomes a new version.', screen: 'Supplier › RFQ inbox', result: 'Reply status: Offer received or Declined.' },
      { title: 'الرد على الطلب', sub: 'عرض أو اعتذار', does: 'يرد كل مورد بالنموذج نفسه: السعر ورسوم التجهيز والوحدات والتواريخ والمخرجات والتقارير والشروط والصلاحية، أو يعتذر مع ذكر السبب. كل تعديل نسخة جديدة.', screen: 'المورد › صندوق الطلبات', result: 'حالة الرد: وصل عرض أو مرفوض.' }),
    S('n', 'ops', 7, null, 'o-rfqs',
      { title: 'Nudge late reply', sub: 'before the reply date', does: 'Operations watches RFQs with no reply and reminds the supplier before the deadline. In the prototype, reminders are simulated and no message is sent.', screen: 'Operations › RFQ monitor', result: 'Faster offers for the brand.' },
      { title: 'تذكير بالرد المتأخر', sub: 'قبل موعد الرد', does: 'تتابع العمليات الطلبات التي لم يُرد عليها وتذكّر المورد قبل الموعد. في النموذج الأولي التذكيرات محاكاة ولا تُرسل أي رسالة.', screen: 'العمليات › متابعة الطلبات', result: 'عروض أسرع للعلامة.' }, { side: true }),
    S('s6', 'platform', 8, 6, 'c-rfqs',
      { title: 'Line up offers', sub: 'fee and VAT on own lines', does: 'Replies are put on the same basis: supplier price, platform fee and VAT where it applies on separate lines, coverage, deliverables and validity. Every difference from the request is flagged for explicit acceptance.', screen: 'Brand › RFQs & offers', result: 'Offers the brand can compare line by line.' },
      { title: 'توحيد العروض', sub: 'الرسوم والضريبة في بنود منفصلة', does: 'توضع الردود على الأساس نفسه: سعر المورد ورسوم المنصة والضريبة عند انطباقها في بنود منفصلة، مع التغطية والمخرجات والصلاحية. ويُعلَّم كل اختلاف عن الطلب لموافقة صريحة.', screen: 'العلامة › طلبات العروض والعروض', result: 'عروض تستطيع العلامة مقارنتها بنداً ببند.' }),
    S('s7', 'brand', 9, 7, 'c-rfqs',
      { title: 'Approve and pay', sub: 'dates held until paid', does: 'The brand approves each offer version, accepting any flagged difference, and checks out once. Offers are re-checked and the dates are held while payment completes.', screen: 'Brand › Checkout', result: 'One payment and reserved bookings. RFQ status: Booked or Partly booked.' },
      { title: 'الموافقة والدفع', sub: 'التواريخ محجوزة حتى الدفع', does: 'تعتمد العلامة كل نسخة عرض مع الموافقة على أي اختلاف مُعلَّم، وتدفع مرة واحدة. يُعاد فحص العروض وتُحجز التواريخ مؤقتاً حتى يكتمل الدفع.', screen: 'العلامة › الدفع', result: 'دفعة واحدة وحجوزات مؤقتة. حالة الطلب: محجوز أو محجوز جزئياً.' }),
    S('t', 'ops', 10, null, 'o-payments',
      { title: 'Confirm payment', sub: 'provider event', does: 'Payment is confirmed only by the payment provider’s signed event; in the prototype it is simulated. If the hold expires first, the dates are released and any late payment is refunded.', screen: 'Operations › Payments', result: 'Payment status: Paid. Bookings confirmed.' },
      { title: 'تأكيد الدفع', sub: 'حدث من مزوّد الدفع', does: 'لا يُؤكد الدفع إلا بحدث موقّع من مزوّد الدفع، وهو محاكى في النموذج الأولي. إذا انتهى الحجز المؤقت أولاً يُفرج عن التواريخ ويُسترد أي دفع متأخر.', screen: 'العمليات › المدفوعات', result: 'حالة الدفع: مدفوع. تأكدت الحجوزات.' }, { side: true }),
    S('s8', 'supplier', 10, 8, 's-bookings',
      { title: 'Deliver', sub: 'status updates', does: 'The supplier moves the booking through Preparing, Live and Completed. The brand sees every change.', screen: 'Supplier › Bookings', result: 'Booking status: Completed.' },
      { title: 'التنفيذ', sub: 'تحديثات الحالة', does: 'ينقل المورد الحجز عبر «قيد التحضير» ثم «قيد التنفيذ» ثم «مكتمل»، وترى العلامة كل تغيير.', screen: 'المورد › الحجوزات', result: 'حالة الحجز: مكتمل.' }),
    S('s9', 'supplier', 11, 9, 's-bookings',
      { title: 'Report results', sub: 'how each was measured', does: 'The supplier enters each result and how it was measured: counted, system data or estimated.', screen: 'Supplier › Bookings › Results', result: 'Results the brand can check before signing off.' },
      { title: 'الإبلاغ عن النتائج', sub: 'مع طريقة القياس', does: 'يدخل المورد كل نتيجة وطريقة قياسها: محصاة أو بيانات نظام أو تقديرية.', screen: 'المورد › الحجوزات › النتائج', result: 'نتائج تراجعها العلامة قبل الاعتماد.' }),
    S('s10', 'brand', 12, 10, 'c-bookings',
      { title: 'Sign off', sub: 'accept or dispute', does: 'The brand accepts delivery after the report, or opens a dispute that withholds the payout. It can add its own outcome, such as new customers and revenue.', screen: 'Brand › Bookings', result: 'Delivery accepted; payout becomes eligible when all checks pass.' },
      { title: 'اعتماد التنفيذ', sub: 'القبول أو النزاع', does: 'تقبل العلامة التنفيذ بعد التقرير، أو تفتح نزاعاً يحتجز الصرف. ويمكنها إضافة نتيجتها مثل العملاء الجدد والإيرادات.', screen: 'العلامة › الحجوزات', result: 'قبول التنفيذ؛ ويصبح الصرف مؤهلاً عند اجتياز كل الفحوصات.' }),
    S('s11', 'ops', 13, 11, 'o-payments',
      { title: 'Release payout', sub: 'five checks must pass', does: 'Operations can release a payout only when payment is received, delivery is accepted, no dispute is open, no refund is outstanding and the supplier licence review is in date.', screen: 'Operations › Payments', result: 'Payout status: Released.' },
      { title: 'الإفراج عن المستحقات', sub: 'يجب اجتياز خمسة فحوصات', does: 'لا تفرج العمليات عن المستحقات إلا بعد استلام الدفعة وقبول التنفيذ وعدم وجود نزاع مفتوح أو استرداد معلّق وسريان مراجعة رخصة المورد.', screen: 'العمليات › المدفوعات', result: 'حالة المستحقات: تم الإفراج.' }),
    S('s12', 'ops', 14, 12, 'o-metrics',
      { title: 'Weekly review', sub: 'metrics, go / no-go', does: 'Operations reviews pilot metrics, updates unit economics with real data and marks each kill criterion.', screen: 'Operations › Pilot metrics', result: 'The current GO / NO-GO reading.' },
      { title: 'المراجعة الأسبوعية', sub: 'المؤشرات وقرار المضي', does: 'تراجع العمليات مؤشرات التجربة، وتحدّث اقتصاديات الوحدة ببيانات حقيقية، وتقيّم كل معيار إيقاف.', screen: 'العمليات › مؤشرات التجربة', result: 'قراءة المضي أو التوقف الحالية.' })
  ];

  /* Play order and connectors */
  const order = ['p1', 'p2', 's1', 's2', 's3', 's4', 's5', 'n', 's6', 's7', 't', 's8', 's9', 's10', 's11', 's12'];
  const edges = [
    ['p1', 'p2'], ['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's5'], ['s5', 's6'], ['s6', 's7'], ['s7', 's8'], ['s8', 's9'], ['s9', 's10'], ['s10', 's11', { endShift: 22 }], ['s11', 's12'],
    ['n', 's5', { dashed: true }], ['t', 's11', { dashed: true, offset: .78, label: 'payment' }]
  ];

  /* Status explorer: each status points at the step that sets it */
  const records = [
    { id: 'supplier', who: { en: 'Supplier submits; operations reviews the document', ar: 'يقدّم المورد؛ وتراجع العمليات المستند' }, name: { en: 'Supplier', ar: 'المورد' }, states: [
      { en: 'Licence not submitted', ar: 'لم تُقدَّم الرخصة', step: null }, { en: 'Review pending', ar: 'المراجعة قيد الانتظار', step: 'p1' }, { en: 'Business licence reviewed', ar: 'تمت مراجعة الرخصة التجارية', step: 'p1' }] },
    { id: 'rfq', who: { en: 'Brand sends; checkout books it', ar: 'ترسله العلامة؛ ويُحجز عند الدفع' }, name: { en: 'RFQ', ar: 'طلب العروض' }, states: [
      { en: 'Open', ar: 'مفتوح', step: 's4' }, { en: 'Partly booked', ar: 'محجوز جزئياً', step: 's7' }, { en: 'Booked', ar: 'محجوز', step: 's7' }] },
    { id: 'reply', who: { en: 'Supplier offers; brand approves a version', ar: 'يقدّم المورد العرض؛ وتعتمد العلامة نسخة منه' }, name: { en: 'Supplier reply', ar: 'رد المورد' }, states: [
      { en: 'Awaiting reply', ar: 'بانتظار الرد', step: 's4' }, { en: 'Offer received', ar: 'وصل عرض', step: 's5' }, { en: 'Approved', ar: 'معتمد', step: 's6' }, { en: 'Expired', ar: 'منتهي', step: 's6' }] },
    { id: 'booking', who: { en: 'Supplier up to Completed; brand accepts delivery', ar: 'المورد حتى «مكتمل»؛ والعلامة تقبل التنفيذ' }, name: { en: 'Booking', ar: 'الحجز' }, states: [
      { en: 'Reserved', ar: 'محجوز مؤقتاً', step: 's7' }, { en: 'Confirmed', ar: 'مؤكد', step: 't' }, { en: 'Preparing', ar: 'قيد التحضير', step: 's8' }, { en: 'Live', ar: 'قيد التنفيذ', step: 's8' }, { en: 'Completed', ar: 'مكتمل', step: 's8' }, { en: 'Delivery accepted', ar: 'تم قبول التنفيذ', step: 's10' }] },
    { id: 'payment', who: { en: 'Confirmed only by the payment provider (simulated in the prototype)', ar: 'يُؤكد من مزوّد الدفع فقط (محاكى في النموذج الأولي)' }, name: { en: 'Payment', ar: 'الدفع' }, states: [
      { en: 'Awaiting payment', ar: 'بانتظار الدفع', step: 's7' }, { en: 'Paid', ar: 'مدفوع', step: 't' }] },
    { id: 'payout', who: { en: 'Eligible when all five checks pass; operations releases', ar: 'مؤهلة عند اجتياز الفحوصات الخمسة؛ وتصرفها العمليات' }, name: { en: 'Supplier payout', ar: 'مستحقات المورد' }, states: [
      { en: 'Held', ar: 'محتجزة', step: 's7' }, { en: 'Eligible for release', ar: 'مؤهلة للصرف', step: 's10' }, { en: 'Released', ar: 'تم الإفراج', step: 's11' }] }
  ];

  CON.WORKFLOW = { steps, order, edges, records };
})(typeof window !== 'undefined' ? window : globalThis);

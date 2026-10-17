/* Workflow page data: every step of a project, by role (English and Arabic) */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};

  /* lane: brand | platform | supplier | ops · row: position top to bottom · side: optional task */
  const S = (id, lane, row, num, href, en, ar, extra) => Object.assign({ id, lane, row, num, href, en, ar }, extra || {});
  const steps = [
    S('p1', 'ops', 1, null, 'o-verify',
      { title: 'Verify supplier', sub: 'trade licence check', does: 'Operations checks the supplier’s trade licence, then approves or rejects the application with a note.', screen: 'Operations › Verification', result: 'Verified badge and a higher data-confidence score in every match.' },
      { title: 'توثيق المورد', sub: 'التحقق من الرخصة التجارية', does: 'تتحقق العمليات من الرخصة التجارية للمورد، ثم تعتمد الطلب أو ترفضه مع ملاحظة.', screen: 'العمليات › التوثيق', result: 'شارة التوثيق ودرجة ثقة بيانات أعلى في كل مطابقة.' }, { pre: true }),
    S('p2', 'supplier', 1, null, 's-listings',
      { title: 'List opportunity', sub: 'price, dates, slots', does: 'The supplier adds each opportunity with price, availability, audience, evidence and a photo, or imports a spreadsheet.', screen: 'Supplier › Listings', result: 'The listing is visible to brands in plans and the catalogue.' },
      { title: 'إدراج فرصة', sub: 'السعر والتواريخ والأماكن', does: 'يضيف المورد كل فرصة مع السعر والتوفر والجمهور والأدلة وصورة، أو يستورد جدولاً.', screen: 'المورد › الفرص المدرجة', result: 'تظهر الفرصة للعلامات في الخطط والكتالوج.' }, { pre: true }),
    S('s1', 'brand', 3, 1, 'c-new',
      { title: 'Set objective', sub: 'goal, budget, dates', does: 'The brand answers seven plain questions, or types one sentence that the platform reads. No media terms needed.', screen: 'Brand › New objective', result: 'A saved objective.' },
      { title: 'تحديد الهدف', sub: 'الهدف والميزانية والتواريخ', does: 'تجيب العلامة عن سبعة أسئلة بسيطة، أو تكتب جملة واحدة تقرؤها المنصة. دون مصطلحات إعلانية.', screen: 'العلامة › هدف جديد', result: 'هدف محفوظ.' }),
    S('s2', 'platform', 4, 2, 'c-plans',
      { title: 'Rank matches', sub: '8 factors, packages', does: 'The platform scores every listing on eight visible factors, explains each match, and builds packages within the budget.', screen: 'Brand › Objectives & plans', result: 'A ranked plan with reasons, costs, risks and alternatives.' },
      { title: 'ترتيب الفرص', sub: '٨ عوامل وحزم', does: 'تقيّم المنصة كل فرصة بثمانية عوامل ظاهرة، وتشرح كل مطابقة، وتبني حزماً ضمن الميزانية.', screen: 'العلامة › الأهداف والخطط', result: 'خطة مرتبة مع الأسباب والتكاليف والمخاطر والبدائل.' }),
    S('s3', 'brand', 5, 3, 'c-compare',
      { title: 'Compare, select', sub: 'up to 4 side by side', does: 'The brand compares opportunities on the same factors and selects the ones it wants offers for.', screen: 'Brand › Compare', result: 'A final selection for the RFQ.' },
      { title: 'المقارنة والاختيار', sub: 'حتى ٤ جنباً إلى جنب', does: 'تقارن العلامة الفرص بالعوامل نفسها وتختار ما تريد عروضاً له.', screen: 'العلامة › المقارنة', result: 'اختيار نهائي لطلب العروض.' }),
    S('s4', 'platform', 6, 4, 'c-rfqs',
      { title: 'Send one RFQ', sub: 'to every supplier', does: 'One standard request for quotation goes to every selected supplier, with dates, audience, reporting level and reply date.', screen: 'Brand › RFQs & offers', result: 'RFQ status: Open.' },
      { title: 'إرسال طلب عروض واحد', sub: 'لكل الموردين', does: 'يُرسل طلب عروض أسعار موحد لكل مورد مختار، مع التواريخ والجمهور ومستوى التقارير وموعد الرد.', screen: 'العلامة › طلبات العروض والعروض', result: 'حالة الطلب: مفتوح.' }),
    S('s5', 'supplier', 7, 5, 's-rfqs',
      { title: 'Reply to RFQ', sub: 'offer or decline', does: 'Each supplier answers in the same form: price, setup fee, dates, reporting and payment terms, or declines with a reason.', screen: 'Supplier › RFQ inbox', result: 'Reply status: Offer received or Declined.' },
      { title: 'الرد على الطلب', sub: 'عرض أو اعتذار', does: 'يرد كل مورد بالنموذج نفسه: السعر ورسوم التجهيز والتواريخ والتقارير وشروط الدفع، أو يعتذر مع ذكر السبب.', screen: 'المورد › صندوق الطلبات', result: 'حالة الرد: وصل عرض أو مرفوض.' }),
    S('n', 'ops', 7, null, 'o-rfqs',
      { title: 'Nudge late reply', sub: 'before the reply date', does: 'Operations watches RFQs with no reply and nudges the supplier before the deadline.', screen: 'Operations › RFQ monitor', result: 'Faster offers for the brand.' },
      { title: 'تذكير بالرد المتأخر', sub: 'قبل موعد الرد', does: 'تتابع العمليات الطلبات التي لم يُرد عليها وتذكّر المورد قبل الموعد.', screen: 'العمليات › متابعة الطلبات', result: 'عروض أسرع للعلامة.' }, { side: true }),
    S('s6', 'platform', 8, 6, 'c-rfqs',
      { title: 'Line up offers', sub: 'VAT 5%, fee 7%', does: 'Replies are put on the same basis: net price, VAT 5%, platform fee 7%, cost per day, date coverage and terms.', screen: 'Brand › RFQs & offers', result: 'Offers the brand can compare line by line.' },
      { title: 'توحيد العروض', sub: 'ضريبة ٥٪ ورسوم ٧٪', does: 'توضع الردود على الأساس نفسه: السعر الصافي والضريبة ٥٪ ورسوم المنصة ٧٪ والتكلفة اليومية وتغطية التواريخ والشروط.', screen: 'العلامة › طلبات العروض والعروض', result: 'عروض تستطيع العلامة مقارنتها بنداً ببند.' }),
    S('s7', 'brand', 9, 7, 'c-rfqs',
      { title: 'Approve and pay', sub: 'card or transfer', does: 'The brand approves the offers it wants and pays once, by card, bank transfer or invoice.', screen: 'Brand › Checkout', result: 'Transaction and bookings created. RFQ status: Booked.' },
      { title: 'الموافقة والدفع', sub: 'بطاقة أو تحويل', does: 'توافق العلامة على العروض التي تريدها وتدفع مرة واحدة بالبطاقة أو التحويل البنكي أو الفاتورة.', screen: 'العلامة › الدفع', result: 'إنشاء المعاملة والحجوزات. حالة الطلب: محجوز.' }),
    S('t', 'ops', 10, null, 'o-payments',
      { title: 'Confirm transfer', sub: 'bank or invoice', does: 'For bank transfers and invoices, operations marks the payment as received. Card payments confirm automatically.', screen: 'Operations › Payments', result: 'Payment status: Paid.' },
      { title: 'تأكيد التحويل', sub: 'بنكي أو فاتورة', does: 'في التحويلات البنكية والفواتير، تسجل العمليات استلام الدفعة. أما دفعات البطاقة فتُؤكد تلقائياً.', screen: 'العمليات › المدفوعات', result: 'حالة الدفع: مدفوع.' }, { side: true }),
    S('s8', 'supplier', 10, 8, 's-bookings',
      { title: 'Deliver', sub: 'status updates', does: 'The supplier moves the booking through Preparing, Live and Completed. The brand sees every change.', screen: 'Supplier › Bookings', result: 'Booking status: Completed.' },
      { title: 'التنفيذ', sub: 'تحديثات الحالة', does: 'ينقل المورد الحجز عبر «قيد التحضير» ثم «قيد التنفيذ» ثم «مكتمل»، وترى العلامة كل تغيير.', screen: 'المورد › الحجوزات', result: 'حالة الحجز: مكتمل.' }),
    S('s9', 'supplier', 11, 9, 's-bookings',
      { title: 'Report results', sub: 'how each was measured', does: 'The supplier enters each result and how it was measured: counted, system data or estimated.', screen: 'Supplier › Bookings › Results', result: 'Results the brand can check before signing off.' },
      { title: 'الإبلاغ عن النتائج', sub: 'مع طريقة القياس', does: 'يدخل المورد كل نتيجة وطريقة قياسها: محصاة أو بيانات نظام أو تقديرية.', screen: 'المورد › الحجوزات › النتائج', result: 'نتائج تراجعها العلامة قبل الاعتماد.' }),
    S('s10', 'brand', 12, 10, 'c-bookings',
      { title: 'Sign off', sub: 'delivery and outcome', does: 'The brand confirms delivery and adds its own outcome, such as new customers and revenue.', screen: 'Brand › Bookings', result: 'Delivery confirmed, payout ready, cost per customer calculated from the brand’s numbers.' },
      { title: 'اعتماد التنفيذ', sub: 'التنفيذ والنتيجة', does: 'تؤكد العلامة التنفيذ وتضيف نتيجتها، مثل العملاء الجدد والإيرادات.', screen: 'العلامة › الحجوزات', result: 'تأكيد التنفيذ، والمستحقات جاهزة، وحساب تكلفة العميل من أرقام العلامة.' }),
    S('s11', 'ops', 13, 11, 'o-payments',
      { title: 'Release payout', sub: 'once paid and signed', does: 'Operations releases the supplier’s payout only when delivery is confirmed and payment is received.', screen: 'Operations › Payments', result: 'Payout status: Released.' },
      { title: 'الإفراج عن المستحقات', sub: 'بعد الدفع والاعتماد', does: 'تفرج العمليات عن مستحقات المورد فقط بعد تأكيد التنفيذ واستلام الدفعة.', screen: 'العمليات › المدفوعات', result: 'حالة المستحقات: تم الإفراج.' }),
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
    { id: 'supplier', who: { en: 'Supplier submits; operations decides', ar: 'يقدّم المورد؛ وتقرر العمليات' }, name: { en: 'Supplier', ar: 'المورد' }, states: [
      { en: 'Unverified', ar: 'غير موثق', step: null }, { en: 'Verification pending', ar: 'التوثيق قيد المراجعة', step: 'p1' }, { en: 'Verified', ar: 'موثق', step: 'p1' }] },
    { id: 'rfq', who: { en: 'Brand sends; checkout books it', ar: 'ترسله العلامة؛ ويُحجز عند الدفع' }, name: { en: 'RFQ', ar: 'طلب العروض' }, states: [
      { en: 'Open', ar: 'مفتوح', step: 's4' }, { en: 'Booked', ar: 'محجوز', step: 's7' }] },
    { id: 'reply', who: { en: 'Supplier', ar: 'المورد' }, name: { en: 'Supplier reply', ar: 'رد المورد' }, states: [
      { en: 'Awaiting reply', ar: 'بانتظار الرد', step: 's4' }, { en: 'Offer received', ar: 'وصل عرض', step: 's5' }] },
    { id: 'booking', who: { en: 'Supplier up to Completed; brand confirms delivery', ar: 'المورد حتى «مكتمل»؛ والعلامة تؤكد التنفيذ' }, name: { en: 'Booking', ar: 'الحجز' }, states: [
      { en: 'Confirmed', ar: 'مؤكد', step: 's7' }, { en: 'Preparing', ar: 'قيد التحضير', step: 's8' }, { en: 'Live', ar: 'قيد التنفيذ', step: 's8' }, { en: 'Completed', ar: 'مكتمل', step: 's8' }, { en: 'Delivery confirmed', ar: 'تم تأكيد التنفيذ', step: 's10' }] },
    { id: 'payment', who: { en: 'Card: automatic; transfer or invoice: operations', ar: 'البطاقة: تلقائي؛ التحويل أو الفاتورة: العمليات' }, name: { en: 'Payment', ar: 'الدفع' }, states: [
      { en: 'Awaiting payment', ar: 'بانتظار الدفع', step: 's7' }, { en: 'Paid', ar: 'مدفوع', step: 't' }] },
    { id: 'payout', who: { en: 'Ready when the brand confirms; operations releases', ar: 'جاهزة عند تأكيد العلامة؛ وتفرج عنها العمليات' }, name: { en: 'Supplier payout', ar: 'مستحقات المورد' }, states: [
      { en: 'Held', ar: 'محتجزة', step: 's7' }, { en: 'Ready to release', ar: 'جاهزة للإفراج', step: 's10' }, { en: 'Released', ar: 'تم الإفراج', step: 's11' }] }
  ];

  CON.WORKFLOW = { steps, order, edges, records };
})(typeof window !== 'undefined' ? window : globalThis);

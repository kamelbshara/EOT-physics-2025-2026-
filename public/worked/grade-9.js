export default {
  "G9A-Q01": {
    "problem": {
      "en": "Does insulation slow the cooling of a cup? Design a fair comparison.",
      "ar": "هل يُبطئ العزل تبريد الكوب؟ صمّم مقارنة عادلة."
    },
    "strategy": {
      "en": "Compare temperature drops over the same time. Decide in advance what result would support the hypothesis.",
      "ar": "قارن انخفاض الحرارة خلال الزمن نفسه، وحدد مسبقًا النتيجة التي تؤيد الفرضية."
    },
    "steps": [
      {
        "en": "Fill identical cups from the same hot water. Wrap one cup only, so insulation is the one deliberate difference.",
        "ar": "املأ كوبين متماثلين من الماء الساخن نفسه وغلّف أحدهما فقط، ليبقى العزل هو الفرق المقصود."
      },
      {
        "en": "Measure both temperature drops after 8 min and repeat. A consistently smaller drop for the wrapped cup supports slower cooling.",
        "ar": "قِس الانخفاض بعد 8 دقائق وكرّر التجربة. إذا تكرر الانخفاض الأصغر في الكوب المعزول، فهذه نتيجة تدعم تبريده الأبطأ."
      }
    ]
  },
  "G9A-Q02": {
    "problem": {
      "en": "Can a single dot represent a spinning suitcase on a moving belt?",
      "ar": "هل تكفي نقطة واحدة لتمثيل حقيبة تدور أثناء انتقالها على سير؟"
    },
    "strategy": {
      "en": "Decide what the model must predict before simplifying the object.",
      "ar": "حدّد ما ينبغي أن يتنبأ به النموذج قبل تبسيط الجسم."
    },
    "steps": [
      {
        "en": "To track travel time, mark the centre at successive instants. Its changing position captures translation.",
        "ar": "لمتابعة زمن الانتقال عيّن المركز في أزمنة متتالية، فتغيّر موقعه يمثّل الحركة الانتقالية."
      },
      {
        "en": "To predict which corner reaches a sensor first, track the corners as well. A dot carries no orientation information.",
        "ar": "لتوقّع أي زاوية تصل إلى المستشعر أولًا تتبّع الزوايا أيضًا، لأن النقطة لا تمثّل اتجاه الحقيبة."
      }
    ]
  },
  "G9A-Q03": {
    "problem": {
      "en": "One statement links gas pressure to volume. Another explains the link through particle collisions. Classify them.",
      "ar": "عبارة تربط ضغط الغاز بحجمه، وأخرى تفسّر العلاقة بتصادم الجسيمات. صنّفهما."
    },
    "strategy": {
      "en": "Look for a description of a repeatable pattern versus an explanation of its mechanism.",
      "ar": "ابحث عن وصف لنمط متكرر وعن تفسير للآلية التي تنتجه."
    },
    "steps": [
      {
        "en": "At fixed temperature for a fixed amount of ideal gas, pV is constant. This relationship is Boyle’s law.",
        "ar": "عند ثبات حرارة وكمية غاز مثالي، يبقى pV ثابتًا. هذه العلاقة هي قانون بويل."
      },
      {
        "en": "A particle model explains how more frequent wall collisions raise pressure in a smaller volume. That explanation belongs to kinetic theory.",
        "ar": "يشرح نموذج الجسيمات كيف ترفع التصادمات الأكثر تكرارًا مع الجدار الضغط في حجم أصغر. ينتمي هذا التفسير إلى النظرية الحركية."
      }
    ]
  },
  "G9A-Q04": {
    "problem": {
      "en": "A sensor records a pulse lasting 420 μs. Express it in milliseconds.",
      "ar": "يسجّل مستشعر نبضة مدتها 420 μs. عبّر عنها بالمللي ثانية."
    },
    "strategy": {
      "en": "Build a conversion factor in which microseconds cancel.",
      "ar": "كوّن معامل تحويل تُختصر فيه وحدة الميكروثانية."
    },
    "steps": [
      {
        "en": "One millisecond contains 1000 microseconds because the prefixes differ by three powers of ten.",
        "ar": "المللي ثانية يساوي 1000 ميكروثانية، لأن الفرق بين البادئتين ثلاث مراتب عشرية."
      },
      {
        "en": "Multiply 420 μs by 1 ms / 1000 μs to obtain 0.42 ms. The numerical value shrinks when the unit grows.",
        "ar": "اضرب 420 μs في 1 ms / 1000 μs فتحصل على 0.42 ms. تصغر القيمة العددية عندما تكبر الوحدة."
      }
    ]
  },
  "G9A-Q05": {
    "problem": {
      "en": "A plate is 6.4 cm by 2.35 cm. Report its area to the justified precision.",
      "ar": "لوح أبعاده 6.4 cm و2.35 cm. احسب مساحته بالدقة المناسبة."
    },
    "strategy": {
      "en": "Multiply without rounding, then apply the significant-figure rule for products.",
      "ar": "اضرب دون تقريب، ثم طبّق قاعدة الأرقام المعنوية للضرب."
    },
    "steps": [
      {
        "en": "6.4 × 2.35 = 15.04. Each length contributes a centimetre, giving cm².",
        "ar": "حاصل 6.4 × 2.35 هو 15.04. يساهم كل طول بوحدة السنتيمتر فتصبح الوحدة cm²."
      },
      {
        "en": "The first length has two significant figures, so report 15 cm². Its two digits are significant.",
        "ar": "للطول الأول رقمان معنويان، لذا نكتب المساحة 15 cm²، وكلا رقميها معنوي."
      }
    ]
  },
  "G9A-Q06": {
    "problem": {
      "en": "A 100.0 g reference gives readings of 98.1, 98.2 and 98.1 g. Evaluate the balance.",
      "ar": "أعطت كتلة مرجعية مقدارها 100.0 g قراءات 98.1 و98.2 و98.1 g. قيّم الميزان."
    },
    "strategy": {
      "en": "Use spread to assess repeatability and the reference to assess accuracy.",
      "ar": "استعمل تشتت النتائج لتقييم الدقة، والقيمة المرجعية لتقييم الضبط."
    },
    "steps": [
      {
        "en": "The range is only 0.1 g, so repeated readings cluster closely.",
        "ar": "المدى 0.1 g فقط، ما يدل على تقارب القياسات المتكررة."
      },
      {
        "en": "Their mean is about 98.13 g, nearly 1.87 g below the reference. The results are precise but show a systematic offset worth checking.",
        "ar": "المتوسط نحو 98.13 g، أي أقل من المرجع بنحو 1.87 g. القراءات دقيقة التقارب ويُستحسن فحص انحياز الميزان."
      }
    ]
  },
  "G9A-Q07": {
    "problem": {
      "en": "A measurement y takes values 3, 12 and 27 at x = 1, 2 and 3. Which graph would straighten the data?",
      "ar": "تأخذ y القيم 3 و12 و27 عند x = 1 و2 و3. ما الرسم الذي يحوّل النمط إلى خط مستقيم؟"
    },
    "strategy": {
      "en": "Test a ratio for each candidate relationship before choosing the axes.",
      "ar": "اختبر النسب المناسبة للعلاقات المحتملة قبل اختيار المحورين."
    },
    "steps": [
      {
        "en": "y/x is 3, 6, 9, so one constant slope through the origin cannot describe y against x.",
        "ar": "تساوي y/x القيم 3 و6 و9، فلا يصف الرسم مقابل x خطًّا واحدًا يمر بالأصل بميل ثابت."
      },
      {
        "en": "y/x² is 3 in all three cases. Plot y against x² to obtain a straight line of slope 3.",
        "ar": "تساوي y/x² القيمة 3 في الحالات الثلاث. ارسم y مقابل x² لتحصل على خط مستقيم ميله 3."
      }
    ]
  },
  "G9A-Q08": {
    "problem": {
      "en": "A cart leaves dots at 0, 2, 6 and 12 cm every 0.2 s. Describe its motion.",
      "ar": "تترك عربة نقاطًا عند 0 و2 و6 و12 cm كل 0.2 s. صِف حركتها."
    },
    "strategy": {
      "en": "Compare the distances covered in equal time intervals.",
      "ar": "قارن المسافات المقطوعة في فترات زمنية متساوية."
    },
    "steps": [
      {
        "en": "Subtract adjacent positions to obtain gaps of 2, 4 and 6 cm. Each belongs to the same 0.2 s interval.",
        "ar": "اطرح كل موقع من التالي لتحصل على فجوات 2 و4 و6 cm. كل فجوة تخص فترة 0.2 s."
      },
      {
        "en": "The cart covers more distance in each interval and the positions increase. It moves faster in the positive direction.",
        "ar": "تقطع العربة مسافة أكبر في كل فترة وتزداد إحداثياتها، فهي تتسارع في الاتجاه الموجب."
      }
    ]
  },
  "G9A-Q09": {
    "problem": {
      "en": "A sled moves 6 m east and a horizontal force does 18 J of work. Which recorded quantity needs a direction?",
      "ar": "تتحرك زلاجة 6 m شرقًا وتبذل قوة أفقية شغلًا مقداره 18 J. أي الكميتين تحتاج إلى اتجاه؟"
    },
    "strategy": {
      "en": "Ask whether reversing the axis changes how the same observation is represented.",
      "ar": "اسأل كيف يتغيّر تمثيل المشاهدة نفسها إذا عكست المحور."
    },
    "steps": [
      {
        "en": "The displacement is +6 m with east positive. Reversing the axis makes it −6 m because displacement has a direction.",
        "ar": "الإزاحة +6 m عند اختيار الشرق موجبًا، وتصبح −6 m عند عكس المحور لأن للإزاحة اتجاهًا."
      },
      {
        "en": "Work is the scalar product of force and displacement. Reversing the coordinate axis leaves the physical work at 18 J.",
        "ar": "الشغل حاصل ضرب قياسي للقوة والإزاحة. يبقى الشغل الفيزيائي 18 J عند عكس محور الإحداثيات."
      }
    ]
  },
  "G9A-Q10": {
    "problem": {
      "en": "A dot moves from x = 7 to 5 to 3 m at times 0, 1 and 2 s. Sketch the position graph.",
      "ar": "تنتقل نقطة من x = 7 إلى 5 ثم 3 m عند الأزمنة 0 و1 و2 s. ارسم منحنى الموقع."
    },
    "strategy": {
      "en": "Pair each time with its position before drawing a trend.",
      "ar": "اربط كل زمن بموقعه قبل رسم الخط."
    },
    "steps": [
      {
        "en": "Plot (0,7), (1,5), (2,3) with time horizontal. Equal time steps give equal changes of −2 m.",
        "ar": "مثّل النقاط (0,7) و(1,5) و(2,3) والزمن أفقي. التغيّر في كل فترة متساوية هو −2 m."
      },
      {
        "en": "For uniform motion join them by a straight descending line. Its slope is −2 m/s even though every position shown is positive.",
        "ar": "للحركة المنتظمة صِل النقاط بخط مستقيم هابط. ميله −2 m/s رغم أن جميع المواقع الممثلة موجبة."
      }
    ]
  },
  "G9A-Q11": {
    "problem": {
      "en": "Two carts follow x₁ = 2t and x₂ = 12 − t in SI units. When and where do their graphs cross?",
      "ar": "يتبع جسمان x₁ = 2t وx₂ = 12 − t بوحدات النظام الدولي. متى وأين يتقاطع المنحنيان؟"
    },
    "strategy": {
      "en": "At a crossing both coordinates must agree at the same time.",
      "ar": "عند التقاطع يتساوى الموقعان في اللحظة نفسها."
    },
    "steps": [
      {
        "en": "Set 2t = 12 − t. Adding t to both sides gives 3t = 12 and t = 4 s.",
        "ar": "ضع 2t = 12 − t. بإضافة t إلى الطرفين نحصل على 3t = 12 ثم t = 4 s."
      },
      {
        "en": "Substitute into each relation: 2 × 4 = 8 and 12 − 4 = 8. Both carts are at x = 8 m, with different velocities.",
        "ar": "عوّض في العلاقتين: 2 × 4 = 8 و12 − 4 = 8. الجسمان عند x = 8 m لكن سرعتيهما مختلفتان."
      }
    ]
  },
  "G9A-Q12": {
    "problem": {
      "en": "For x = 2t² in SI units, compare the average velocity from 0 to 4 s with the instantaneous velocity at 4 s.",
      "ar": "للحركة x = 2t² بوحدات النظام الدولي، قارن السرعة المتوسطة من 0 إلى 4 s باللحظية عند 4 s."
    },
    "strategy": {
      "en": "Use the secant slope for the interval and the tangent slope for the instant.",
      "ar": "استخدم ميل القاطع للفترة وميل المماس للحظة."
    },
    "steps": [
      {
        "en": "The secant rises 32 m in 4 s, giving an average of 8 m/s.",
        "ar": "يرتفع القاطع 32 m خلال 4 s، فتكون السرعة المتوسطة 8 m/s."
      },
      {
        "en": "The tangent slope is dx/dt = 4t, giving 16 m/s at 4 s. The curve steepens, which explains the larger final speed.",
        "ar": "ميل المماس هو dx/dt = 4t، فيعطي 16 m/s عند 4 s. ازدياد انحدار المنحنى يفسّر كِبر السرعة النهائية."
      }
    ]
  },
  "G9A-Q13": {
    "problem": {
      "en": "A lift moves downward at 3 m/s with an upward acceleration of 1 m/s². What happens over the next second?",
      "ar": "ينزل مصعد بسرعة 3 m/s وله تسارع نحو الأعلى قدره 1 m/s². ماذا يحدث خلال الثانية التالية؟"
    },
    "strategy": {
      "en": "Assign signs on one axis, then compare the initial and final speed magnitudes.",
      "ar": "عيّن الإشارات على محور واحد، ثم قارن مقداري السرعتين."
    },
    "steps": [
      {
        "en": "Take up as positive. Then v₀ = −3 m/s and the velocity change is +1 m/s in one second.",
        "ar": "اختر الأعلى موجبًا. تكون v₀ = −3 m/s ويكون تغيّر السرعة +1 m/s في ثانية."
      },
      {
        "en": "Adding gives −2 m/s. The lift still moves down, but its speed falls from 3 to 2 m/s because acceleration opposes velocity.",
        "ar": "الجمع يعطي −2 m/s. ما زال المصعد يهبط، لكن مقدار سرعته انخفض من 3 إلى 2 m/s لأن التسارع يعاكسها."
      }
    ]
  },
  "G9A-Q14": {
    "problem": {
      "en": "A tram accelerates uniformly from 4 to 13 m/s in 3 s. Find its acceleration.",
      "ar": "يزداد مقدار سرعة ترام في خط مستقيم من 4 إلى 13 m/s بانتظام خلال 3 s. جد تسارعه."
    },
    "strategy": {
      "en": "Rearrange the constant-acceleration velocity law for the unknown.",
      "ar": "أعد ترتيب قانون السرعة للتسارع الثابت بحيث تعزل المجهول."
    },
    "steps": [
      {
        "en": "Subtract the starting velocity because acceleration measures change: Δv = 13 − 4 = 9 m/s.",
        "ar": "اطرح السرعة الابتدائية لأن التسارع يقيس التغيّر: Δv = 13 − 4 = 9 m/s."
      },
      {
        "en": "Divide by 3 s to get 3 m/s². Checking 4 + 3 × 3 returns 13 m/s.",
        "ar": "اقسم على 3 s فتحصل على 3 m/s². وبالتعويض 4 + 3 × 3 تعود إلى 13 m/s."
      }
    ]
  },
  "G9A-Q15": {
    "problem": {
      "en": "A cart slows uniformly from 8 m/s to rest over 16 m. Find its acceleration.",
      "ar": "تتباطأ عربة بانتظام من 8 m/s إلى السكون خلال 16 m. جد تسارعها."
    },
    "strategy": {
      "en": "Time is missing. Choose the motion law linking speed squared to displacement.",
      "ar": "الزمن غير معطى. اختر العلاقة التي تربط مربع السرعة بالإزاحة."
    },
    "steps": [
      {
        "en": "Take forward as positive. Substitute v² − u² = 0 − 64 because the final speed is zero.",
        "ar": "اختر الأمام موجبًا. عوّض v² − u² = 0 − 64 لأن السرعة النهائية صفر."
      },
      {
        "en": "Divide by 2Δx = 32 m to obtain −2 m/s². The negative sign agrees with slowing down while moving forward.",
        "ar": "اقسم على 2Δx = 32 m لتحصل على −2 m/s². تتفق الإشارة السالبة مع تباطؤ جسم يتحرك للأمام."
      }
    ]
  },
  "G9A-Q16": {
    "problem": {
      "en": "A ball is tossed vertically upward at 15 m/s. Using g = 10 m/s², find its time to the peak and its acceleration there.",
      "ar": "قُذفت كرة رأسيًا للأعلى بسرعة 15 m/s. باستخدام g = 10 m/s²، جد زمن القمة والتسارع عندها."
    },
    "strategy": {
      "en": "Use the instant of zero vertical velocity as the stopping condition for the ascent.",
      "ar": "استخدم لحظة انعدام السرعة الرأسية شرطًا لانتهاء الصعود."
    },
    "steps": [
      {
        "en": "With up positive and negligible air drag, v = 15 − 10t. Gravity keeps the acceleration at −10 m/s².",
        "ar": "باختيار الأعلى موجبًا وإهمال الهواء يكون v = 15 − 10t. تُبقي الجاذبية التسارع عند −10 m/s²."
      },
      {
        "en": "Set v = 0 to find t = 1.5 s. Gravity still acts at the peak, so the acceleration remains downward.",
        "ar": "ضع v = 0 فتجد t = 1.5 s. تظل الجاذبية مؤثرة عند القمة، فيبقى التسارع نحو الأسفل."
      }
    ]
  },
  "G9A-Q17": {
    "problem": {
      "en": "A dial has divisions of 0.2 N. Using a half-division uncertainty, report a reading of 3.4 N.",
      "ar": "تدريج مقياس قوة 0.2 N. باستخدام قاعدة نصف التدريج، سجّل قراءة 3.4 N."
    },
    "strategy": {
      "en": "Use the specified instrument convention and carry its unit into the uncertainty.",
      "ar": "استعمل القاعدة المحددة للأداة واحتفظ بالوحدة مع عدم اليقين."
    },
    "steps": [
      {
        "en": "Half of 0.2 N is 0.1 N. This is the uncertainty under the stated convention.",
        "ar": "نصف 0.2 N هو 0.1 N، وهو عدم اليقين وفق القاعدة المعطاة."
      },
      {
        "en": "Report (3.4 ± 0.1) N. The decimal places match so the last quoted digit reflects the precision.",
        "ar": "اكتب (3.4 ± 0.1) N. تتطابق المنازل العشرية فيعكس آخر رقم دقة القياس."
      }
    ]
  },
  "G9A-Q18": {
    "problem": {
      "en": "A walker travels 24 m north and 9 m south in 15 s. Compare average speed and average velocity.",
      "ar": "يسير شخص 24 m شمالًا ثم 9 m جنوبًا في 15 s. قارن السرعة المتوسطة بالسرعة المتجهة المتوسطة."
    },
    "strategy": {
      "en": "Keep two totals: path length and signed displacement.",
      "ar": "احسب مجموعين مستقلين: طول المسار والإزاحة بإشارتها."
    },
    "steps": [
      {
        "en": "Path length adds both legs: 24 + 9 = 33 m. Divide by 15 s for an average speed of 2.2 m/s.",
        "ar": "طول المسار يجمع المرحلتين: 24 + 9 = 33 m. اقسم على 15 s لتحصل على سرعة متوسطة 2.2 m/s."
      },
      {
        "en": "With north positive the displacement is 24 − 9 = 15 m. The average velocity is 1.0 m/s north.",
        "ar": "عند اعتبار الشمال موجبًا تكون الإزاحة 24 − 9 = 15 m، فتكون السرعة المتجهة المتوسطة 1.0 m/s شمالًا."
      }
    ]
  },
  "G9A-Q19": {
    "problem": {
      "en": "A position graph goes from −4 m to +5 m, then back to +1 m. Find distance and displacement.",
      "ar": "ينتقل منحنى الموقع من −4 m إلى +5 m ثم يعود إلى +1 m. جد المسافة والإزاحة."
    },
    "strategy": {
      "en": "Split the path at the turning point, then compare the endpoints.",
      "ar": "قسّم المسار عند نقطة الانعطاف ثم قارن بين موقعي البداية والنهاية."
    },
    "steps": [
      {
        "en": "The two path lengths are 9 m and 4 m, giving a distance of 13 m because both legs count positively.",
        "ar": "طولا الجزأين 9 m و4 m، فالمسافة 13 m لأن كليهما يُجمع بالموجب."
      },
      {
        "en": "The final minus initial position is 1 − (−4) = +5 m. This net change does not depend on the detour.",
        "ar": "الموقع النهائي ناقص الابتدائي يساوي 1 − (−4) = +5 m. لا يعتمد هذا التغيّر الكلي على التفاف المسار."
      }
    ]
  },
  "G9A-Q20": {
    "problem": {
      "en": "Velocity falls linearly from +6 to −2 m/s over 4 s. Find acceleration and displacement.",
      "ar": "تنخفض السرعة المتجهة خطيًا من +6 إلى −2 m/s خلال 4 s. جد التسارع والإزاحة."
    },
    "strategy": {
      "en": "Use slope for acceleration and signed area for displacement on the same graph.",
      "ar": "استخرج التسارع من الميل والإزاحة من المساحة الجبرية للرسم نفسه."
    },
    "steps": [
      {
        "en": "Slope = (−2 − 6)/4 = −2 m/s². The velocity reaches zero after 3 s.",
        "ar": "الميل = (−2 − 6)/4 = −2 m/s². تصل السرعة إلى الصفر بعد 3 s."
      },
      {
        "en": "The areas are +½ × 3 × 6 and −½ × 1 × 2. Adding gives +8 m because the second interval reverses part of the motion.",
        "ar": "المساحتان +½ × 3 × 6 و−½ × 1 × 2. جمعهما يعطي +8 m لأن الحركة في الفترة الثانية تعكس جزءًا من الإزاحة."
      }
    ]
  }
}

/**
 * Comprehensive audit script for family-data.ts
 * Checks for: duplicate IDs, duplicate spouse IDs, gender issues,
 * relationship inconsistencies, orphaned references, etc.
 */

import { readFileSync } from 'fs';

const raw = readFileSync('./family-data.ts', 'utf-8');

// Extract the people array using regex
const peopleMatches = [...raw.matchAll(/\{\s*id:\s*"(p\d+)"[^}]*?name:\s*"([^"]*)"[^}]*?gender:\s*"(male|female)"[^}]*?fatherId:\s*(?:"(p\d+)"|null)[^}]*?motherId:\s*(?:"(p\d+)"|null)/gs)];

// Build people map
const people = new Map();
const allSpouseIds = new Map(); // spouseId -> personId

// Extract all person records
const personRegex = /\{\s*id:\s*"(p\d+)",\s*name:\s*"([^"]*)",\s*gender:\s*"(male|female)",\s*relation:\s*"[^"]*",\s*fatherId:\s*(?:"(p\d+)"|null),\s*motherId:\s*(?:"(p\d+)"|null),\s*spouses:\s*\[([\s\S]*?)\],\s*notes:\s*"([^"]*)"/g;

let match;
while ((match = personRegex.exec(raw)) !== null) {
  const [, id, name, gender, fatherId, motherId, spousesRaw, notes] = match;
  
  // Extract spouses
  const spouseRegex = /\{\s*id:\s*"(s\d+)",\s*type:\s*"(external|linked)",\s*name:\s*"([^"]*)"(?:,\s*personId:\s*"(p\d+)")?,\s*label:\s*"([^"]*)",\s*childrenIds:\s*\[([^\]]*)\]/g;
  const spouses = [];
  let sm;
  while ((sm = spouseRegex.exec(spousesRaw)) !== null) {
    const childrenStr = sm[6].trim();
    const childrenIds = childrenStr ? childrenStr.split(',').map(c => c.trim().replace(/"/g, '')) : [];
    spouses.push({
      spouseId: sm[1],
      type: sm[2],
      name: sm[3],
      personId: sm[4] || null,
      label: sm[5],
      childrenIds
    });
  }
  
  if (people.has(id)) {
    console.log(`❌ DUPLICATE PERSON ID: "${id}" (name: "${name}") already exists as "${people.get(id).name}"`);
  }
  
  people.set(id, { id, name, gender, fatherId, motherId, spouses, notes });
}

console.log(`\n📊 Total persons found: ${people.size}`);
console.log('='.repeat(80));

// ====== 1. Check for duplicate person IDs ======
console.log('\n🔍 1. DUPLICATE PERSON IDS CHECK');
console.log('-'.repeat(40));
const idCounts = {};
const idRegex = /id:\s*"(p\d+)"/g;
let idMatch;
while ((idMatch = idRegex.exec(raw)) !== null) {
  const id = idMatch[1];
  idCounts[id] = (idCounts[id] || 0) + 1;
}
let dupIdFound = false;
for (const [id, count] of Object.entries(idCounts)) {
  if (count > 1) {
    console.log(`  ❌ Person ID "${id}" appears ${count} times`);
    dupIdFound = true;
  }
}
if (!dupIdFound) console.log('  ✅ No duplicate person IDs found');

// ====== 2. Check for duplicate spouse IDs ======
console.log('\n🔍 2. DUPLICATE SPOUSE IDS CHECK');
console.log('-'.repeat(40));
const spouseIdCounts = {};
const spouseIdRegex = /id:\s*"(s\d+)"/g;
let sidMatch;
while ((sidMatch = spouseIdRegex.exec(raw)) !== null) {
  const sid = sidMatch[1];
  spouseIdCounts[sid] = (spouseIdCounts[sid] || 0) + 1;
}
let dupSidFound = false;
for (const [sid, count] of Object.entries(spouseIdCounts)) {
  if (count > 2) { // linked spouses appear twice (on each side)
    console.log(`  ❌ Spouse ID "${sid}" appears ${count} times (expected max 2 for linked)`);
    dupSidFound = true;
  }
}
// Check external spouses appearing more than once
for (const [sid, count] of Object.entries(spouseIdCounts)) {
  if (count === 2) {
    // Check if it's actually a linked relationship (should appear on both sides)
    // or if it's duplicated
    let isLinked = false;
    for (const [, person] of people) {
      for (const sp of person.spouses) {
        if (sp.spouseId === sid && sp.type === 'linked') {
          isLinked = true;
          break;
        }
      }
      if (isLinked) break;
    }
    if (!isLinked) {
      console.log(`  ⚠️ External spouse ID "${sid}" appears ${count} times - may be duplicated`);
      dupSidFound = true;
    }
  }
}
if (!dupSidFound) console.log('  ✅ No problematic duplicate spouse IDs found');

// ====== 3. Gender consistency checks ======
console.log('\n🔍 3. GENDER CONSISTENCY CHECKS');
console.log('-'.repeat(40));

// 3a. Check spouse labels match gender
let genderIssues = 0;
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    if (person.gender === 'male') {
      // Male should have wife (زوجة), not husband (زوج)
      if (sp.label.includes('الزوج') && !sp.label.includes('الزوجة')) {
        console.log(`  ❌ ${person.name} (${id}) is MALE but spouse label is "${sp.label}" (should be wife/الزوجة)`);
        genderIssues++;
      }
    } else if (person.gender === 'female') {
      // Female should have husband (الزوج), not wife (الزوجة)
      if (sp.label.includes('الزوجة')) {
        console.log(`  ❌ ${person.name} (${id}) is FEMALE but spouse label is "${sp.label}" (should be husband/الزوج)`);
        genderIssues++;
      }
    }
  }
}

// 3b. Check linked spouses have consistent genders
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    if (sp.type === 'linked' && sp.personId) {
      const linkedPerson = people.get(sp.personId);
      if (linkedPerson) {
        if (person.gender === linkedPerson.gender) {
          console.log(`  ❌ SAME GENDER MARRIAGE: ${person.name} (${id}, ${person.gender}) linked to ${linkedPerson.name} (${sp.personId}, ${linkedPerson.gender})`);
          genderIssues++;
        }
      }
    }
  }
}

// 3c. Check names that typically belong to one gender
const typicallyFemale = ['فاطمة', 'خديجة', 'عائشة', 'آمنة', 'زينب', 'رقية', 'مريم', 'سعاد', 'نفيسة', 'أم الحسين', 'أم الفضل', 'أم كلثوم', 'سيدة', 'حنان', 'هند', 'سلوى', 'منى', 'هبة', 'أماني', 'أمل', 'أميرة', 'سمية', 'إيمان', 'هدى', 'ثريا', 'علوية', 'آسيا', 'صفية', 'كوثر', 'عفاف', 'عواطف', 'بتول', 'رحاب', 'اكرام', 'اللالة', 'الرشيدية', 'سعدية', 'الحرم', 'عابدة', 'بشرية', 'التومة', 'أمنة', 'مدينة', 'محاسن', 'نعمات', 'بثينة', 'شريفة', 'ماجدة', 'صباح', 'نجاة', 'بلقيس', 'هاجر', 'إيناس', 'نمارق', 'تسنيم', 'الشريفية', 'لبنى', 'ولاء', 'مي', 'آلاء', 'إسراء', 'آيات', 'ليلى', 'نسرين', 'شيرين', 'الماس', 'أسيل', 'لينة', 'أسماء', 'ذروة', 'أريج', 'ماريا', 'العافية', 'انتصار', 'إخلاص', 'القسم', 'وداد', 'شادية', 'فايزة', 'السادة', 'انعام'];
const typicallyMale = ['محمد', 'أحمد', 'عبدالماجد', 'عمر', 'ابوبكر', 'أبوبكر', 'عبدالله', 'خالد', 'حسين', 'نعيم', 'عبدالحليم', 'الباقر', 'بابكر', 'حاج احمد', 'عبدالمنعم', 'محمود', 'عبدالغني', 'عبدالرازق', 'عبدالسلام', 'سيداحمد', 'سيد احمد', 'عبدالوهاب', 'الطاهر', 'يوسف', 'عبدالرحمن', 'إبراهيم', 'إسماعيل', 'عثمان', 'علي', 'عبدالكريم', 'مصطفى', 'كمال', 'صلاح', 'هاشم', 'طارق', 'حمزة', 'مصعب', 'الطيب', 'عبدالرحيم', 'حسان', 'متوكل', 'أبو عبيدة', 'عبدالباسط', 'شمس الدين', 'النور', 'السيد', 'مجذوب', 'المنصور', 'معتصم', 'عبدالعزيز', 'عبداللطيف', 'عبدالرزق', 'عزالدين', 'نصر الدين', 'أكرم', 'أشرف', 'أنور', 'أيمن', 'الامين', 'العباس', 'بشير', 'أمير', 'كمال', 'مروان', 'متوكل', 'جوني', 'حمد', 'وائل', 'ميسر', 'عبدالقادر', 'تيسير', 'المعز', 'شوقي', 'الهادي', 'النذير', 'طلال'];

for (const [id, person] of people) {
  if (person.gender === 'male' && typicallyFemale.includes(person.name)) {
    console.log(`  ⚠️ POSSIBLE GENDER MISMATCH: ${person.name} (${id}) is marked as MALE but name is typically female`);
    genderIssues++;
  }
  if (person.gender === 'female' && typicallyMale.includes(person.name)) {
    console.log(`  ⚠️ POSSIBLE GENDER MISMATCH: ${person.name} (${id}) is marked as FEMALE but name is typically male`);
    genderIssues++;
  }
}

if (genderIssues === 0) console.log('  ✅ No gender issues found');

// ====== 4. Father/Mother gender checks ======
console.log('\n🔍 4. FATHER/MOTHER GENDER CHECKS');
console.log('-'.repeat(40));
let parentGenderIssues = 0;
for (const [id, person] of people) {
  if (person.fatherId) {
    const father = people.get(person.fatherId);
    if (father && father.gender !== 'male') {
      console.log(`  ❌ ${person.name} (${id})'s father ${father.name} (${person.fatherId}) is marked as ${father.gender}`);
      parentGenderIssues++;
    }
    if (!father && !person.fatherId.startsWith('s')) {
      console.log(`  ⚠️ ${person.name} (${id}) references non-existent father ID: ${person.fatherId}`);
      parentGenderIssues++;
    }
  }
  if (person.motherId) {
    const mother = people.get(person.motherId);
    if (mother && mother.gender !== 'female') {
      console.log(`  ❌ ${person.name} (${id})'s mother ${mother.name} (${person.motherId}) is marked as ${mother.gender}`);
      parentGenderIssues++;
    }
    if (!mother && !person.motherId.startsWith('s')) {
      console.log(`  ⚠️ ${person.name} (${id}) references non-existent mother ID: ${person.motherId}`);
      parentGenderIssues++;
    }
  }
}
if (parentGenderIssues === 0) console.log('  ✅ All father/mother genders are correct');

// ====== 5. Orphaned children references ======
console.log('\n🔍 5. ORPHANED CHILDREN REFERENCES');
console.log('-'.repeat(40));
let orphanedRefs = 0;
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    for (const childId of sp.childrenIds) {
      if (!people.has(childId)) {
        console.log(`  ❌ ${person.name} (${id}) spouse "${sp.name || sp.personId}" references non-existent child: ${childId}`);
        orphanedRefs++;
      }
    }
  }
}
if (orphanedRefs === 0) console.log('  ✅ No orphaned children references');

// ====== 6. Linked spouse consistency ======
console.log('\n🔍 6. LINKED SPOUSE CONSISTENCY');
console.log('-'.repeat(40));
let linkedIssues = 0;
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    if (sp.type === 'linked' && sp.personId) {
      const linkedPerson = people.get(sp.personId);
      if (!linkedPerson) {
        console.log(`  ❌ ${person.name} (${id}) links to non-existent person: ${sp.personId}`);
        linkedIssues++;
        continue;
      }
      
      // Check if the linked person has a reciprocal link back
      const hasReciprocal = linkedPerson.spouses.some(s => s.type === 'linked' && s.personId === id);
      if (!hasReciprocal) {
        console.log(`  ❌ ${person.name} (${id}) links to ${linkedPerson.name} (${sp.personId}) but NO reciprocal link found`);
        linkedIssues++;
      }
      
      // Check if children lists match
      const reciprocal = linkedPerson.spouses.find(s => s.type === 'linked' && s.personId === id);
      if (reciprocal) {
        const childrenA = JSON.stringify([...sp.childrenIds].sort());
        const childrenB = JSON.stringify([...reciprocal.childrenIds].sort());
        if (childrenA !== childrenB) {
          console.log(`  ⚠️ MISMATCHED CHILDREN: ${person.name} (${id}) children: [${sp.childrenIds}] vs ${linkedPerson.name} (${sp.personId}) children: [${reciprocal.childrenIds}]`);
          linkedIssues++;
        }
      }
    }
  }
}
if (linkedIssues === 0) console.log('  ✅ All linked spouses are consistent');

// ====== 7. Children not listed in parent's spouse ======
console.log('\n🔍 7. CHILDREN NOT IN PARENT SPOUSE RECORDS');
console.log('-'.repeat(40));
let childParentIssues = 0;
for (const [id, person] of people) {
  if (person.fatherId) {
    const father = people.get(person.fatherId);
    if (father) {
      const isInFatherSpouse = father.spouses.some(sp => sp.childrenIds.includes(id));
      if (!isInFatherSpouse && father.spouses.length > 0) {
        console.log(`  ⚠️ ${person.name} (${id}) has father ${father.name} (${person.fatherId}) but is NOT listed in any of father's spouse childrenIds`);
        childParentIssues++;
      }
    }
  }
  if (person.motherId) {
    const mother = people.get(person.motherId);
    if (mother) {
      // For mothers who are "linked" type (part of the family tree), check their spouses
      const isInMotherSpouse = mother.spouses.some(sp => sp.childrenIds.includes(id));
      if (!isInMotherSpouse && mother.spouses.length > 0) {
        console.log(`  ⚠️ ${person.name} (${id}) has mother ${mother.name} (${person.motherId}) but is NOT listed in any of mother's spouse childrenIds`);
        childParentIssues++;
      }
    }
  }
}
if (childParentIssues === 0) console.log('  ✅ All children properly linked to parent spouse records');

// ====== 8. Children in spouse record but missing fatherId/motherId ======
console.log('\n🔍 8. CHILDREN IN SPOUSE RECORD BUT MISSING PARENT LINK');
console.log('-'.repeat(40));
let missingParentLink = 0;
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    for (const childId of sp.childrenIds) {
      const child = people.get(childId);
      if (!child) continue;
      
      if (person.gender === 'male') {
        if (child.fatherId !== id) {
          console.log(`  ⚠️ ${child.name} (${childId}) listed as child of ${person.name} (${id}) but fatherId=${child.fatherId}`);
          missingParentLink++;
        }
      } else if (person.gender === 'female') {
        if (child.motherId !== id) {
          // Only flag if the mother is a linked/internal person
          if (sp.type === 'linked' || sp.type === 'external') {
            // For women, they are the mother. Check if child has correct motherId
            if (child.motherId !== id && child.motherId !== null) {
              console.log(`  ⚠️ ${child.name} (${childId}) listed as child of ${person.name} (${id}) but motherId=${child.motherId}`);
              missingParentLink++;
            }
          }
        }
      }
    }
  }
}
if (missingParentLink === 0) console.log('  ✅ All children have correct parent links');

// ====== 9. Check for children with p081 who have 3 children in spouse vs 5 in data ======
console.log('\n🔍 9. CHILDREN COUNT MISMATCHES IN SPOUSE RECORDS');
console.log('-'.repeat(40));

// Check p081 (اللالة) specifically and p977 (العباس)
const p081 = people.get('p081');
if (p081) {
  for (const sp of p081.spouses) {
    const actualChildren = [...people.values()].filter(p => p.motherId === 'p081');
    if (sp.childrenIds.length !== actualChildren.length) {
      console.log(`  ⚠️ اللالة (p081) spouse record lists ${sp.childrenIds.length} children: [${sp.childrenIds}]`);
      console.log(`     but ${actualChildren.length} people have motherId=p081: [${actualChildren.map(c => c.id)}]`);
    }
  }
}

// ====== 10. Duplicate spouse ID "s327" check ======
console.log('\n🔍 10. SPECIFIC DUPLICATE SPOUSE ID CHECKS');
console.log('-'.repeat(40));
// Check s327 and s281 specifically
for (const sid of ['s327', 's281', 's288']) {
  const usages = [];
  for (const [id, person] of people) {
    for (const sp of person.spouses) {
      if (sp.spouseId === sid) {
        usages.push(`${person.name} (${id})`);
      }
    }
  }
  if (usages.length > 0) {
    console.log(`  Spouse ID "${sid}" used by: ${usages.join(', ')}`);
  }
}

// ====== 11. p009 (حميدة) gender check ======
console.log('\n🔍 11. SPECIFIC NAME-GENDER REVIEW');
console.log('-'.repeat(40));
const suspectNames = [
  { id: 'p009', reason: 'اسم "حميدة" عادة اسم أنثوي لكنه مسجل كذكر' },
];
for (const { id, reason } of suspectNames) {
  const p = people.get(id);
  if (p) {
    console.log(`  ℹ️ ${p.name} (${id}) - gender: ${p.gender} - ${reason}`);
    // Check: is this person a father of anyone?
    const isfather = [...people.values()].some(c => c.fatherId === id);
    const ismother = [...people.values()].some(c => c.motherId === id);
    console.log(`     Is someone's father: ${isfather}, Is someone's mother: ${ismother}`);
    if (p.spouses.length > 0) {
      console.log(`     Spouse labels: ${p.spouses.map(s => s.label).join(', ')}`);
    }
  }
}

// ====== 12. Missing p225 in children list ======
console.log('\n🔍 12. CHILDREN LISTED IN DATA BUT NOT IN PARENT SPOUSE');
console.log('-'.repeat(40));
let missingInSpouse = 0;
for (const [id, person] of people) {
  if (person.fatherId) {
    const father = people.get(person.fatherId);
    if (father && father.spouses.length > 0) {
      const inAnySpouse = father.spouses.some(sp => sp.childrenIds.includes(id));
      if (!inAnySpouse) {
        console.log(`  ❌ ${person.name} (${id}) fatherId=${person.fatherId} (${father.name}) but NOT in any spouse's childrenIds`);
        missingInSpouse++;
      }
    }
  }
}
if (missingInSpouse === 0) console.log('  ✅ All children are listed in their parent\'s spouse records');

// ====== 13. Children in spouse but childId doesn't exist ======
console.log('\n🔍 13. NON-EXISTENT CHILDREN IN SPOUSE RECORDS');
console.log('-'.repeat(40));
let nonExistentChildren = 0;
for (const [id, person] of people) {
  for (const sp of person.spouses) {
    for (const childId of sp.childrenIds) {
      if (!people.has(childId)) {
        console.log(`  ❌ ${person.name} (${id}) spouse lists child ${childId} which DOES NOT EXIST in data`);
        nonExistentChildren++;
      }
    }
  }
}
if (nonExistentChildren === 0) console.log('  ✅ All children in spouse records exist in data');

// ====== 14. Summary of missing IDs (gaps) ======
console.log('\n🔍 14. MISSING PERSON IDS (REFERENCED BUT NOT DEFINED)');
console.log('-'.repeat(40));
const allReferencedIds = new Set();
for (const [id, person] of people) {
  if (person.fatherId) allReferencedIds.add(person.fatherId);
  if (person.motherId) allReferencedIds.add(person.motherId);
  for (const sp of person.spouses) {
    if (sp.personId) allReferencedIds.add(sp.personId);
    for (const childId of sp.childrenIds) allReferencedIds.add(childId);
  }
}
let missingDefs = 0;
for (const refId of allReferencedIds) {
  if (!people.has(refId)) {
    console.log(`  ❌ ID "${refId}" is referenced but NOT defined as a person`);
    missingDefs++;
  }
}
if (missingDefs === 0) console.log('  ✅ All referenced IDs are defined');

// ====== 15. Check p1065, p1066 ======
console.log('\n🔍 15. CHECKING SPECIFIC ORPHANED ENTRIES');
console.log('-'.repeat(40));
for (const checkId of ['p1065', 'p1066', 'p920']) {
  if (people.has(checkId)) {
    console.log(`  ✅ ${checkId} exists: ${people.get(checkId).name}`);
  } else {
    // Check if referenced anywhere
    let referencedIn = [];
    for (const [id, person] of people) {
      for (const sp of person.spouses) {
        if (sp.childrenIds.includes(checkId)) {
          referencedIn.push(`${person.name} (${id})`);
        }
      }
    }
    if (referencedIn.length > 0) {
      console.log(`  ❌ ${checkId} does NOT exist but is referenced by: ${referencedIn.join(', ')}`);
    } else {
      console.log(`  ℹ️ ${checkId} neither exists nor is referenced`);
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('✅ AUDIT COMPLETE');
console.log('='.repeat(80));

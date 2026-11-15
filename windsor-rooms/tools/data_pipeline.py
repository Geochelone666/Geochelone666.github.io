#!/usr/bin/env python3
"""Windsor Rooms canonical-data validator and safe next-term CSV importer.

Examples:
  python3 data_pipeline.py validate --data ../uwindsor_fall2026_classrooms/Windsor_Rooms_v3_data.json
  python3 data_pipeline.py import --csv export.csv --term "Winter 2027" \
    --start 2027-01-04 --end 2027-04-30 --base previous.json --out winter2027.json

Input CSV must have schema of Windsor_Rooms_v3_Full_Schedule.csv.
Unknown room bookings remain unknown; importer never infers they are free.
"""
import argparse, collections, csv, datetime as dt, json, pathlib, re, sys, gzip

HEADERS = ("RecordType","Building","Room","Weekday","ExactDate","ValidFrom","ValidTo",
           "Start","End","Course","CourseName","Component","Section","ClassNumber","Instructor")
WEEKDAYS = {"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"}
TIME = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")

def iso(v):
    if not isinstance(v,str) or not DATE.fullmatch(v): return False
    try: return dt.date.fromisoformat(v).isoformat()==v
    except ValueError: return False

def fail(problem): raise ValueError(problem)

def load_json(path):
    data=pathlib.Path(path).read_bytes()
    if data.startswith(b"\x1f\x8b"): data=gzip.decompress(data)
    return json.loads(data.decode("utf8"))

def validate(dataset):
    info=dataset.get("info") or {}
    events=dataset.get("events") or []
    rooms=dataset.get("rooms") or []
    if not isinstance(events,list) or not isinstance(rooms,list):fail("events/rooms must be lists")
    if not iso(info.get("termStart")) or not iso(info.get("termEnd")) or info["termStart"]>info["termEnd"]:fail("Invalid term dates")
    keys=set(tuple(r) for r in rooms)
    if len(keys)!=len(rooms):fail("Duplicate room entries")
    if any(len(r)!=2 or not all(isinstance(c,str) and c.strip() for c in r) for r in rooms):fail("Invalid room locator")
    seen=set(); classes=[];exams=[];errors=[];courses=set()
    for n,e in enumerate(events):
        if len(e)!=14:errors.append(f"Record {n} has {len(e)} fields (expected 14)");continue
        typ,building,room,day,date,startDate,endDate,start,end,code,part,sect,num,title=e
        if typ not in ("class","exam"):errors.append(f"Record {n}: bad type");continue
        if (building,room) not in keys:errors.append(f"Record {n}: unknown room {building}|{room}")
        if not TIME.fullmatch(start) or not TIME.fullmatch(end) or start>=end:errors.append(f"Record {n}: invalid time")
        if not isinstance(code,str) or not code.strip():errors.append(f"Record {n}: empty course")
        if typ=="class":
            classes.append(e)
            if day not in WEEKDAYS or not iso(startDate) or not iso(endDate) or startDate>endDate:errors.append(f"Record {n}: invalid weekly dates")
            if not num:errors.append(f"Record {n}: missing class number")
        else:
            exams.append(e)
            if not iso(date):errors.append(f"Record {n}: missing exam date")
        if code: courses.add(code)
        entry=tuple(e)
        if entry in seen:errors.append(f"Record {n}: duplicate exact entry")
        seen.add(entry)
    if errors:fail("; ".join(errors[:12])+f" ... ({len(errors)} total)" if len(errors)>12 else "; ".join(errors))
    faculty=dataset.get("faculty",{})
    comp={str(e[12]) for e in classes if e[9].startswith("COMP ")}
    comp_mapped={n for n in comp if faculty.get(n)}
    sites=dataset.get("compLab",{}).get("sites",[])
    realLab={e[12] for e in classes if e[9].startswith("COMP ") and e[10]=="LAB"}
    siteNums={n for s in sites for n in s.get("classNumbers",[])}
    if realLab !=siteNums:fail(f"COMP LAB site coverage mismatch: data {len(realLab)} vs site {len(siteNums)}")
    warning=[]
    if len(comp_mapped)<len(comp):warning.append(f"{len(comp)-len(comp_mapped)} COMP physical section instructor names unavailable")
    if len(events)!=(info.get("classes",0)+info.get("exams",0)):fail("Info event counts inconsistent")
    if info.get("rooms")!=len(rooms):fail("Info room count inconsistent")
    labLocations={(s["building"],s["room"]) for s in sites}
    if not labLocations.issubset(keys):fail("COMP LAB metadata contains unknown rooms")
    count_no_regular=sum(not any(e[0]=="class" and e[1]==r[0] and e[2]==r[1] for e in events) for r in rooms)
    return {"term":info.get("termName"),"classes":len(classes),"exams":len(exams),"rooms":len(keys),
            "distinctCoursesWithRoom":len(courses),"compPhysicalSections":len(comp),
            "compInstructorsMapped":len(comp_mapped),"compLABSections":len(realLab),
            "compLABLocations":len(sites),"roomsWithoutRegularClass":count_no_regular,
            "warnings":warning}

def import_csv(args):
    source=pathlib.Path(args.csv);base=load_json(args.base)
    if not iso(args.start) or not iso(args.end) or args.start>args.end:fail("Term dates invalid")
    records=[];faculty={}
    with source.open(newline="",encoding="utf-8-sig") as f:
        reader=csv.DictReader(f)
        if not set(HEADERS).issubset(reader.fieldnames or []):fail("CSV headers missing: "+str(set(HEADERS)-set(reader.fieldnames or [])))
        for n,row in enumerate(reader,start=2):
            e=[row.get(k,"").strip() for k in HEADERS]
            typ=e[0]
            if typ not in ("class","exam"):fail(f"CSV row {n}: bad record type")
            records.append([e[0],e[1],e[2],e[3],e[4],e[5],e[6],e[7],e[8],e[9],e[11],e[12],e[13],e[10]])
            num=e[13]
            if typ=="class" and num and e[14]:
                faculty.setdefault(num,set()).update(x.strip() for x in e[14].split(" / ") if x.strip())
    info={"termName":args.term,"termStart":args.start,"termEnd":args.end,"courses":args.course_count or len(set(e[9] for e in records)),"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")}
    buildings=set((e[1],e[2]) for e in records)
    hardware=base.get("hardware")
    if not hardware:fail("No hardware metadata in base")
    for h in hardware.get("labs",[]):buildings.add((h["building"],h["room"]))
    inventory=sorted([list(k) for k in buildings],key=lambda x:(x[0],x[1]))
    info.update({"classes":sum(e[0]=="class" for e in records),"exams":sum(e[0]=="exam" for e in records),"rooms":len(inventory)})
    compClasses=[e for e in records if e[0]=="class" and e[9].startswith("COMP ")]
    compNumbers=set(e[12] for e in compClasses)
    info["compPhysicalSections"]=len(compNumbers);info["compInstructorsMapped"]=len([x for x in compNumbers if faculty.get(x)])
    csLabs=base["compLab"]["summary"]["confirmedGeneralCSLabs"]
    sites={}
    bybase={(s["building"],s["room"]):s for s in base["compLab"]["sites"]}
    for e in compClasses:
        if e[10]!="LAB":continue
        key=(e[1],e[2])
        record=sites.setdefault(key,{"building":key[0],"room":key[1],"classification":bybase.get(key,{}).get("classification","ordinary-classroom"),"courses":set(),"classNumbers":set(),"weeklySlots":[],"source":bybase.get(key,{}).get("source",""),"evidence":"Classified by actual COMP LAB section; verify student workstations with official room information"})
        record["courses"].add(e[9]);record["classNumbers"].add(e[12]);record["weeklySlots"].append({"course":e[9],"section":e[11],"classNumber":e[12],"day":e[3],"start":e[7],"end":e[8]})
    for k,x in sites.items():
        x["sectionCount"]=len(x["classNumbers"]);x["courses"]=sorted(x["courses"]);x["classNumbers"]=sorted(x["classNumbers"])
    sites=sorted(sites.values(),key=lambda s:(-s["sectionCount"],s["building"],s["room"]))
    summary={"term":args.term,"subject":"COMP","differentCOMPcourses":args.comp_course_count or len(set(e[9] for e in compClasses)),
             "labSites":len(sites),"uniqueLABSections":len(set(x for s in sites for x in s["classNumbers"])),"confirmedGeneralCSLabs":csLabs,
             "sources":["Imported schedule CSV. Hardware classified separately; missing room data must not be interpreted as available."]}
    doc={"info":info,"rooms":inventory,"events":records,"faculty":{k:sorted(v) for k,v in faculty.items()},"hardware":hardware,"compLab":{"summary":summary,"sites":sites}}
    report=validate(doc)
    output=pathlib.Path(args.out)
    if output.exists() and not args.overwrite:fail(f"Output exists: {output} (pass --overwrite only after reviewing)")
    output.parent.mkdir(parents=True,exist_ok=True)
    temp=output.with_name(output.name+".partial")
    temp.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    temp.replace(output)
    gz=output.with_suffix(output.suffix+".gz")
    gz.write_bytes(gzip.compress(output.read_bytes(),compresslevel=9,mtime=0))
    print(json.dumps({"imported":str(output),"gzip":str(gz),"validation":report},ensure_ascii=False,indent=2))

def main():
    parser=argparse.ArgumentParser()
    sub=parser.add_subparsers(dest="mode",required=True)
    v=sub.add_parser("validate");v.add_argument("--data",required=True);v.add_argument("--report")
    imp=sub.add_parser("import")
    imp.add_argument("--csv",required=True);imp.add_argument("--base",required=True);imp.add_argument("--term",required=True);imp.add_argument("--start",required=True);imp.add_argument("--end",required=True);imp.add_argument("--out",required=True)
    imp.add_argument("--course-count",type=int,default=None);imp.add_argument("--comp-course-count",type=int,default=None);imp.add_argument("--overwrite",action="store_true")
    args=parser.parse_args()
    try:
        if args.mode=="validate":
            d=load_json(args.data);r=validate(d)
            if args.report:pathlib.Path(args.report).write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding="utf8")
            print(json.dumps({"status":"PASS",**r},ensure_ascii=False,indent=2))
        else:import_csv(args)
    except (ValueError,KeyError,OSError,json.JSONDecodeError) as e:print("VALIDATION FAILED:",str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()

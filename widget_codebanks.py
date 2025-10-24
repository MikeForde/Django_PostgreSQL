# widget_codebanks.py
# Codebanks copied from import_tex.html data-readcodes blocks.
# Keep these lists in UPPERCASE exactly as emitted in the template.

WIDGET_CODES: dict[str, set[str]] = {
    # --- PULHHEEMS -------------------------------------------------------------
    "PULHHEEMS": {
        # Physical (P)
        "RAFPUP01","RAFPUP02","RAFPUP21","RAFPUP22","RAFPUP31","RAFPUP32",
        "RAFPUP41","RAFPUP42","RAFPUP71","RAFPUP72","RAFPUP81","RAFPUP82",
        # Upper limbs (U)
        "RAFPUU01","RAFPUU02","RAFPUU21","RAFPUU22","RAFPUU31","RAFPUU32",
        "RAFPUU71","RAFPUU72","RAFPUU81","RAFPUU82",
        # Lower limbs (L)
        "RAFPUL01","RAFPUL02","RAFPUL21","RAFPUL22","RAFPUL31","RAFPUL32",
        "RAFPUL71","RAFPUL72","RAFPUL81","RAFPUL82",
        # Mental (M)
        "RAFPUM21","RAFPUM31","RAFPUM71","RAFPUM81",
        # Stability (S)
        "RAFPUS01","RAFPUS02","RAFPUS21","RAFPUS22","RAFPUS31","RAFPUS32",
        "RAFPUS71","RAFPUS72","RAFPUS81","RAFPUS82",
        # Deployability radio group
        "TRIQQNMF1","TRIQQNML1","TRIQQNMN1",
        # JMES A/L/M/E select groups
        "TRIQQNA11","TRIQQNA21","TRIQQNA31","TRIQQNA41","TRIQQNA51","TRIQQNA61",
        "TRIQQNL11","TRIQQNL21","TRIQQNL31","TRIQQNL41","TRIQQNL51","TRIQQNL61",
        "TRIQQNM11","TRIQQNM21","TRIQQNM31","TRIQQNM41","TRIQQNM51","TRIQQNM61",
        "TRIQQNE11","TRIQQNE21","TRIQQNE31","TRIQQNE41","TRIQQNE51","TRIQQNE61",
        # JMES status
        "RAFMETE5","RAFMEPE1","RAFMENO3",
        # Diary entry
        "RAFPUPU1",
    },

    # --- VisualAcuity (uncorrected/corrected lists + summary boxes) -----------
    "VISUALACUITY": {
        # Right uncorrected codes
        "2B6D","2B61","2B62","2B6D","2B63","2B64","2B6B","2B65","2B66","2B67","2B6E",
        "2B68","2B69","2B6C","2B6A","2B6A","2B6B",
        # Left uncorrected codes
        "2B7D","2B71","2B72","2B7E","2B73","2B74","2B7B","2B75","2B76","2B77","2B7D",
        "2B78","2B79","2B7C","2B7A","2B7A","2B7B",
        # Corrected (right)
        "TRIQQOE57","TRISOZ2","TRISOZ3","TRISOZ4","TRISOZ5","TRISOZ6","TRISOZ7","TRISOZ8","TRISOZ9",
        # Corrected (left)
        "TRIQQOE56","TRISO/39","TRISO/40","TRISO/41","TRISO/44","TRISO/46","TRISO/48","TRISO/61","TRISO/65",
        # Summary mini-boxes (same sets as in PULHHEEMS eyes summary)
        "RAFPUER1","RAFPUER2","RAFPUER3","RAFPUER4","RAFPUER5","RAFPUER6","RAFPUER7","RAFPUER8",
        "RAFPUEC17","RAFPUEC2","RAFPUEC3","RAFPUEC4","RAFPUEC5","RAFPUEC6","RAFPUEC7","RAFPUEC8",
        "RAFPUEL3","RAFPUEL4","RAFPUEL5","RAFPUEL6","RAFPUEL7","RAFPUEL8","RAFPUEL9","RAFPUEU1",
        "RAFPUEC1","RAFPUEC10","RAFPUEC11","RAFPUEC12","RAFPUEC13","RAFPUEC14","RAFPUEC15","RAFPUEC16",
    },

    # --- Audiometry (entry + repeat + initial-analysis + sums/H-grade) ---------
    "AUDIOMETRY": {
        # Entry fields (Right)
        "RAFAURI17","RAFAURI16","RAFAURI15","RAFAURI19","RAFAURI14","RAFAURI13","RAFAURI12",
        # Entry fields (Left)
        "RAFAULE17","RAFAULE16","RAFAULE15","RAFAULE20","RAFAULE14","RAFAULE13","RAFAULE12",
        # Repeat radio
        "DMSAC009",
        # Initial analysis button code list
        "DMSACA02","DMSACA04","DMSACA05","DMSACA06","DMSACA07","DMSACA08","DMSACA09",
        # Sums
        "CABESSU2","CABESSU1","CABESSU4","CABESSU3",
        # H grades
        "RAFPUH11","RAFPUH21","RAFPUH31","RAFPUHR1","RAFPUHR2",
        "RAFPUHL1","RAFPUHL2","RAFPUHL3","RAFPUHL4","RAFPUHL5",
    },

    # --- AudiometryCompare: (no unique codes beyond the standard audiometry block)
    "AUDIOMETRYCOMPARE": set(),

    # --- Small calculated/utility widgets -------------------------------------
    "IDEALWEIGHT": {"66CB."},
    "BMI": {"22K.."},
    "EXPPEAKFLOW": {"339P."},
    "AVGBP": set(),  # display only
}

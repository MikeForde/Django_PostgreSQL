from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from pathlib import Path
import csv

from myapp.models import ReadSnomedIntMap, ReadSnomedUkMap


BATCH_SIZE = 5000


def _detect_encoding(path: Path) -> str:
    """
    Detect likely encoding by decoding a sample strictly.
    If UTF-8 fails, cp1252 is a common Windows/NHS export encoding.
    """
    sample = path.read_bytes()[:20000]  # small sample is enough
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            sample.decode(enc, errors="strict")
            return enc
        except UnicodeDecodeError:
            continue
    return "latin-1"


def _strip_quotes(s: str | None) -> str:
    if s is None:
        return ""
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return s.strip()


def _load_tsv(path: Path):
    enc = _detect_encoding(path)

    with path.open("r", encoding=enc, errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")

        for row in reader:
            # normalise keys/values (strip surrounding quotes)
            norm = { _strip_quotes(k): _strip_quotes(v) for k, v in row.items() }

            read_code = norm.get("ReadCode", "")
            concept_id = norm.get("ConceptId", "")
            term = norm.get("term", "") or norm.get("Term", "")
            description_id = norm.get("DescriptionId", "")

            if not read_code:
                continue

            if len(read_code) > 10:
                read_code = read_code[:10]

            yield read_code, concept_id, term, description_id


class Command(BaseCommand):
    help = "Import ReadCode->SNOMED mappings from SNOMED TSVs (INT + UK)."

    def add_arguments(self, parser):
        parser.add_argument("--base-dir", default=None, help="Override base folder containing SNOMED/*.tsv")
        parser.add_argument("--truncate", action="store_true", help="Truncate tables before import")
        parser.add_argument("--int-only", action="store_true", help="Import only INT file")
        parser.add_argument("--uk-only", action="store_true", help="Import only UK file")

    @transaction.atomic
    def handle(self, *args, **opts):
        base_dir = Path(opts["base_dir"]) if opts["base_dir"] else Path(settings.BASE_DIR) / "SNOMED"

        int_path = base_dir / "MatchedReadSNOMEDINT.tsv"
        uk_path = base_dir / "MatchedReadSNOMEDUK.tsv"

        if opts["truncate"]:
            if not opts["uk_only"]:
                self.stdout.write("Truncating read_snomed_int_map ...")
                ReadSnomedIntMap.objects.all().delete()
            if not opts["int_only"]:
                self.stdout.write("Truncating read_snomed_uk_map ...")
                ReadSnomedUkMap.objects.all().delete()

        if not opts["uk_only"]:
            if not int_path.exists():
                raise FileNotFoundError(f"Missing file: {int_path}")
            self._import_file(int_path, ReadSnomedIntMap, "INT")

        if not opts["int_only"]:
            if not uk_path.exists():
                raise FileNotFoundError(f"Missing file: {uk_path}")
            self._import_file(uk_path, ReadSnomedUkMap, "UK")

        self.stdout.write(self.style.SUCCESS("Done."))

    def _import_file(self, path: Path, model_cls, label: str):
        self.stdout.write(f"Importing {label}: {path}")

        objs = []
        created = 0
        for read_code, concept_id, term, description_id in _load_tsv(path):
            objs.append(model_cls(
                read_code=read_code,
                concept_id=concept_id,
                term=term,
                description_id=description_id,
            ))

            if len(objs) >= BATCH_SIZE:
                # ignore_conflicts relies on the UniqueConstraint we added
                model_cls.objects.bulk_create(objs, batch_size=BATCH_SIZE, ignore_conflicts=True)
                created += len(objs)
                objs.clear()
                self.stdout.write(f"  inserted ~{created} rows...")

        if objs:
            model_cls.objects.bulk_create(objs, batch_size=BATCH_SIZE, ignore_conflicts=True)
            created += len(objs)

        self.stdout.write(self.style.SUCCESS(f"{label} import complete (attempted {created} rows)."))
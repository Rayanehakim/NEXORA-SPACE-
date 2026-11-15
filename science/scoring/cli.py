"""Compare declared compatible terrain features; missing evidence yields a null score."""
import argparse
import json
import sys
from pathlib import Path
from .engine import compare

def load_json(path):
    def reject_constant(value):
        raise ValueError(f'Non-finite JSON constant: {value}')
    return json.loads(Path(path).read_text(encoding='utf-8-sig'), parse_constant=reject_constant)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('earth', help='Earth FeatureSet JSON')
    parser.add_argument('target', help='Mars or Moon FeatureSet JSON')
    parser.add_argument('--profile', choices=['terrain_mobility', 'geological_survey'], default='terrain_mobility')
    parser.add_argument('--plan', help='Analysis plan JSON; omitted plans produce INCOMPLETE_DATA')
    parser.add_argument('--output', type=Path, help='Write result JSON to this file instead of stdout')
    args = parser.parse_args(argv)
    try:
        result = compare(load_json(args.earth), load_json(args.target), args.profile,
                         load_json(args.plan) if args.plan else None)
        content = json.dumps(result, indent=2, allow_nan=False) + '\n'
        if args.output:
            args.output.write_text(content, encoding='utf-8')
        else:
            sys.stdout.write(content)
    except (OSError, ValueError, TypeError, OverflowError) as error:
        print(f'Input/output error: {error}', file=sys.stderr)
        return 2
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

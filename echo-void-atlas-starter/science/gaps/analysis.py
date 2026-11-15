"""Explain model limitations without inventing planetary measurements or safety limits."""
def analog_gaps(body, rows, blockers, evidence_types, source_url=None):
    def gap(category, claim, implication, evidence='UNKNOWN', source=None):
        return dict(category=category, severity='UNKNOWN', claim=claim,
                    experimentImplication=implication, evidenceType=evidence, sourceUrl=source)
    different = [row['feature'] for row in rows if row['distance'] is not None and row['distance'] > 0]
    physical = ('Differences in comparable descriptors: ' + ', '.join(different) + '.') if different else (
        'Terrain differences are not computable.' if blockers else 'The four supplied terrain descriptors match within this model; material and obstacle properties remain unassessed.')
    physical_evidence = next(iter(evidence_types)) if len(evidence_types) == 1 and not blockers else 'UNKNOWN'
    if body == 'moon':
        planetary = gap('PLANETARY', 'The Moon has a very thin exosphere and different gravity from Earth.',
                        'Earth field rehearsal does not validate lunar operations; conventional rotorcraft cannot fly in lunar vacuum.',
                        'LITERATURE', 'https://science.nasa.gov/moon/facts/')
    elif body == 'mars':
        planetary = gap('PLANETARY', 'Mars has a thin atmosphere and different gravity from Earth.',
                        'Earth terrain rehearsal does not reproduce Mars flight or mobility conditions.',
                        'LITERATURE', 'https://science.nasa.gov/mars/facts/')
    else:
        planetary = gap('PLANETARY', 'Planetary target body is missing or invalid.', 'Choose a supported Mars or Moon target.')
    return [
        gap('PHYSICAL', physical, 'Assess geology, material properties and obstacles separately.', physical_evidence, source_url if physical_evidence == 'MEASURED' else None),
        planetary,
        gap('EVIDENCE', 'Required comparison evidence is incomplete.' if blockers else ('Inputs are simulated test evidence.' if evidence_types == {'SIMULATED'} else 'Source metadata and compatibility declarations require independent scientific review.'),
            'Model weights and tolerances are experimental; an index is not a probability or proof of equivalence.'),
        gap('OPERATIONAL', 'Access, permits, communications and weather have not been assessed.', 'Conduct a separate field and mission feasibility assessment.')
    ]

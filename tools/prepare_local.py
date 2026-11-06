"""Rebuild the private sample catalogue from this PC's installed game."""
import argparse
from prepare_assets import prepare, DEFAULT_GAME, WORK
from prepare_animation import prepare as prepare_animation
from build_catalog import build
from audit_install import audit

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    args=parser.parse_args()
    filters=['*spear_militia*lod0.mesh','*battle_models.modeldb','*export_descr_unit.txt',
             '*en_peasant_padded_england.texture','*en_peasant_padded_france.texture',
             '*final kite_england_diff.texture','*final kite_france_diff.texture']
    prepare(DEFAULT_GAME,WORK/'private-assets',filters)
    prepare_animation();manifest=build();audit()
    if len(manifest['entries'])!=2:raise SystemExit('The expected England/France sample catalogue was not complete.')
    print('Ready. Run START.cmd, then open http://127.0.0.1:8872/')

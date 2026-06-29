#!/usr/bin/env python3
"""Simplify CGTrader boho club OBJ for web (target ~120k faces)."""
import sys
import trimesh
import pyfqmr

SRC = sys.argv[1] if len(sys.argv) > 1 else '/Users/futuret3ch/Downloads/uploads-files-5619270-boho+club.obj'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/Users/futuret3ch/poker-stars/assets/club/boho-interior.glb'
TARGET = int(sys.argv[3]) if len(sys.argv) > 3 else 120000

print(f'Loading {SRC}…')
scene = trimesh.load(SRC, force='scene', process=False)
meshes = []
if isinstance(scene, trimesh.Scene):
    for geom in scene.geometry.values():
        if isinstance(geom, trimesh.Trimesh) and len(geom.faces) > 0:
            meshes.append(geom)
else:
    meshes = [scene]

print(f'Geometries: {len(meshes)}')
combined = trimesh.util.concatenate(meshes)
print(f'Faces before: {len(combined.faces):,}')

if len(combined.faces) > TARGET:
    print(f'Simplifying to {TARGET:,} faces…')
    simp = pyfqmr.Simplify()
    simp.setMesh(combined.vertices, combined.faces)
    simp.simplify_mesh(target_count=TARGET, aggressiveness=7, preserve_border=True, verbose=1)
    v, f, _ = simp.getMesh()
    combined = trimesh.Trimesh(vertices=v, faces=f, process=False)
    print(f'Faces after: {len(combined.faces):,}')

combined.export(OUT)
print(f'Wrote {OUT}')
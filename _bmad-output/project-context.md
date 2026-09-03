---
project_name: 'Project Note'
user_name: 'Guillaume'
date: '2026-08-11'
sections_completed: []
existing_patterns_found: 0
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

_Documented after discovery phase_

## Critical Implementation Rules

_Documented after discovery phase_

## Agent Workflow Behavior

- **Ne jamais s'arrêter aux points de contrôle (HALT/confirmation) purement procéduraux des skills BMad** (ex. le checkpoint de `bmad-code-review` step 1 : "Présenter le résumé du diff... HALT et attendre la confirmation de l'utilisateur"). Présenter le résumé comme information, puis enchaîner automatiquement sur l'étape suivante sans attendre de feu vert explicite.
- **S'applique à tous les skills BMad de ce projet** (`bmad-create-story`, `bmad-dev-story`, `bmad-code-review`, `bmad-sprint-planning`, etc.) chaque fois qu'un HALT sert uniquement à confirmer un périmètre, une sélection de diff, ou une étape déjà déduite du contexte — pas aux checkpoints qui présentent un résultat pour une vraie décision (choix des findings à appliquer, embranchement substantiel, action destructive/irréversible, ambiguïté de spec qu'aucune source ne permet de trancher). Dans le doute, continuer automatiquement pour les portes procédurales, s'arrêter pour les décisions à conséquence réelle.

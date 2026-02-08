import json
from collections import defaultdict

import networkx as nx

from .models import Employee, CommEdge


def build_comm_graph(session) -> nx.DiGraph:
    G = nx.DiGraph()
    employees = session.query(Employee).all()
    for e in employees:
        G.add_node(e.id, type="employee", name=e.full_name, role=e.role, team=e.team)

    edges = session.query(CommEdge).all()
    for e in edges:
        key = (e.from_employee_id, e.to_employee_id)
        if G.has_edge(*key):
            G[key[0]][key[1]]["weight"] += e.weight
            G[key[0]][key[1]]["message_count_30d"] += e.message_count_30d
        else:
            G.add_edge(
                key[0],
                key[1],
                weight=e.weight,
                message_count_30d=e.message_count_30d,
            )
    return G


def build_knowledge_graph(session) -> nx.MultiDiGraph:
    G = nx.MultiDiGraph()
    employees = session.query(Employee).all()
    for e in employees:
        G.add_node(f"emp::{e.id}", type="employee", name=e.full_name, role=e.role)

    edges = session.query(CommEdge).all()
    topic_weight = defaultdict(float)
    for e in edges:
        topics = json.loads(e.topics)
        for t in topics:
            topic_node = f"topic::{t}"
            if not G.has_node(topic_node):
                G.add_node(topic_node, type="topic", name=t)
            G.add_edge(
                f"emp::{e.from_employee_id}",
                topic_node,
                type="MENTIONS",
                weight=e.weight,
            )
            topic_weight[t] += e.weight
    return G


def graph_summary(session):
    G = build_comm_graph(session)
    if G.number_of_nodes() == 0:
        return {
            "nodes": 0,
            "edges": 0,
            "top_senders": [],
            "top_receivers": [],
        }

    out_deg = sorted(G.out_degree(weight="weight"), key=lambda x: x[1], reverse=True)
    in_deg = sorted(G.in_degree(weight="weight"), key=lambda x: x[1], reverse=True)
    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "top_senders": out_deg[:10],
        "top_receivers": in_deg[:10],
    }


def build_department_graph(session):
    employees = session.query(Employee).all()
    emp_role = {e.id: e.role for e in employees}
    roles = sorted({e.role for e in employees})

    edge_map = defaultdict(float)
    edges = session.query(CommEdge).all()
    for e in edges:
        from_role = emp_role.get(e.from_employee_id)
        to_role = emp_role.get(e.to_employee_id)
        if not from_role or not to_role:
            continue
        key = (from_role, to_role)
        edge_map[key] += e.weight

    nodes = [{"id": r, "label": r} for r in roles]
    edge_list = [
        {"source": k[0], "target": k[1], "weight": round(w, 3)}
        for k, w in edge_map.items()
    ]
    return {"nodes": nodes, "edges": edge_list}

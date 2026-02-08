from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Float,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from .db import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    team = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    discord_handle = Column(String, unique=True, nullable=False)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    location = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)

    manager = relationship("Employee", remote_side=[id], backref="reports")


class CommEdge(Base):
    __tablename__ = "comm_edges"

    id = Column(Integer, primary_key=True)
    from_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    to_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    channel = Column(String, nullable=False)
    capacity = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    message_count_30d = Column(Integer, nullable=False)
    last_interaction_at = Column(DateTime, nullable=False)
    topics = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)

    from_employee = relationship("Employee", foreign_keys=[from_employee_id])
    to_employee = relationship("Employee", foreign_keys=[to_employee_id])


class CommEvent(Base):
    __tablename__ = "comm_events"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    from_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    to_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    channel = Column(String, nullable=False)
    capacity = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    summary = Column(Text, nullable=False)

    from_employee = relationship("Employee", foreign_keys=[from_employee_id])
    to_employee = relationship("Employee", foreign_keys=[to_employee_id])


class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    owner = relationship("Employee")


class BoardColumn(Base):
    __tablename__ = "board_columns"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False)

    board = relationship("Board", backref="columns")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    assignee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    reporter_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    due_date = Column(Date, nullable=True)
    labels = Column(Text, nullable=False)
    related_topic = Column(String, nullable=False)
    parent_board_id = Column(Integer, ForeignKey("boards.id"), nullable=True)

    assignee = relationship("Employee", foreign_keys=[assignee_id])
    reporter = relationship("Employee", foreign_keys=[reporter_id])
    parent_board = relationship("Board")


class BoardCard(Base):
    __tablename__ = "board_cards"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    column_id = Column(Integer, ForeignKey("board_columns.id"), nullable=False)
    order_index = Column(Integer, nullable=False)

    board = relationship("Board")
    task = relationship("Task")
    column = relationship("BoardColumn")


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True)
    text = Column(Text, nullable=False)
    decided_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    teams = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    source = Column(String, nullable=False)
    evidence = Column(Text, nullable=True)
    version = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    owner = relationship("Employee")


class ChangeLog(Base):
    __tablename__ = "change_log"

    id = Column(Integer, primary_key=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    before_json = Column(Text, nullable=True)
    after_json = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    source = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

"use strict";

(function () {
  const topicTranslations = {
    Places: "地点",
    Festivals: "节日",
    Technology: "科技",
    "Weather and climate": "天气与气候",
    "Sport and challenge": "运动与挑战",
    "Work and goals": "工作与目标",
    "People and success": "人物与成就",
    "Space and future choices": "太空与未来选择",
    "Festivals and celebrations": "节日与庆祝活动",
    "The internet and technology": "互联网与科技",
    "Sports and competition": "运动与竞赛",
    Business: "商业",
    People: "人物",
    "The universe": "宇宙",
    Animals: "动物",
    "The environment": "环境",
    Transport: "交通",
    "Customs and traditions": "习俗与传统",
    "Health and fitness": "健康与健身",
    "Discovery and invention": "发现与发明",
    Fashion: "时尚",
    Economics: "经济"
  };

  function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function label(english, chinese) {
    const translation = chinese ? '<small class="ui-zh" lang="zh-CN">' + escape(chinese) + '</small>' : "";
    return '<span class="ui-label"><span class="ui-en" lang="en">' + escape(english) +
      '</span>' + translation + '</span>';
  }

  function setLabel(node, english, chinese) {
    node.innerHTML = english ? label(english, chinese) : "";
  }

  const topicsByLowercase = new Map(Object.entries(topicTranslations).map(([topic, chinese]) => [topic.toLowerCase(), chinese]));

  function topicTranslation(topic) {
    return topicsByLowercase.get(topic.toLowerCase()) || "";
  }

  window.UnlockStudentUI = { label, setLabel, topicTranslation };
})();

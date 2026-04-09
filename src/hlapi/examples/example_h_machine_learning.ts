/**
 * Example H — Machine-learning class: classification.
 *
 * Algorithms covered (internally): quantum kernel estimation and
 * variational quantum classifiers.
 *
 * Problem solved: classify flowers into two species from two
 * numeric features (petal length, petal width). The user hands in
 * labelled training data and the unknown flower; the API returns
 * the predicted label.
 */

import { quantum } from "../mod.ts";

const training = [
  { features: [1.4, 0.2], label: "setosa" },
  { features: [1.3, 0.2], label: "setosa" },
  { features: [1.5, 0.2], label: "setosa" },
  { features: [4.7, 1.4], label: "versicolor" },
  { features: [4.5, 1.5], label: "versicolor" },
  { features: [4.9, 1.5], label: "versicolor" },
];

const unknownFlower = [4.6, 1.4];

const result = await quantum("classification")
  .training_data(training)
  .data("custom", unknownFlower)
  .run();

console.log(result.answer()); // → ["versicolor"]

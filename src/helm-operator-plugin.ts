// core-js and regenerator-runtime are required for babel polyfill.
import "core-js/stable";
import "regenerator-runtime/runtime";

// helpers for creating components and client calls.
import * as octant from "./octant/plugin";
import * as c from "./octant/components";

// HelmRelease template
import { searchTable, installedTable, buildHelmRelease } from "./helmreleases";

import { Observable, bindCallback, BehaviorSubject, Subject } from "rxjs";

export default class HelmChartPlugin implements octant.Plugin {
  name = "helm-plugin";
  description = "Helm chart installation plugin";
  isModule = true;

  dashboardClient: octant.DashboardClient;
  httpClient: octant.HTTPClient;

  // Custom properties
  // User fetching setup.
  httpGet: (url: string) => Observable<any>;
  chartUrl = "https://hub.helm.sh/api/chartsvc/v1/charts/search?q=";

  querySubject: Subject<string>;
  chartListSubject: Subject<any[]>;

  capabilities = {
    actionNames: [
      "helm-plugin/installChart",
      "helm-plugin/queryCharts",
      "helm-plugin/deleteChart",
    ],
  };

  constructor(
    dashboardClient: octant.DashboardClient,
    httpClient: octant.HTTPClient
  ) {
    this.dashboardClient = dashboardClient;
    this.httpClient = httpClient;

    this.chartListSubject = new BehaviorSubject(undefined);
    this.querySubject = new BehaviorSubject("<none>");

    this.httpGet = bindCallback(httpClient.get);
  }

  actionHandler(request: octant.ActionRequest): octant.ActionResponse {
    if (request.actionName === "helm-plugin/queryCharts") {
      const query = request.payload.q;
      this.querySubject.next(query);

      const qUrl = this.chartUrl + query;
      this.httpGet(qUrl).subscribe(
        (x) => {
          try {
            this.chartListSubject.next(x.data);
          } catch (e) {
            console.error(e);
          }
        },
        (e) => console.error(e)
      );
      return;
    }

    if (request.actionName === "helm-plugin/installChart") {
      try {
        const namespace = this.dashboardClient.Namespace();
        const helmRelease = buildHelmRelease(
          namespace,
          request.payload.repository,
          request.payload.name,
          request.payload.version
        );
        this.dashboardClient.Create(namespace, helmRelease);
      } catch (e) {
        console.log(e);
      }
      return;
    }

    if (request.actionName === "helm-plugin/deleteChart") {
      try {
        this.dashboardClient.Delete({
          name: request.payload.name,
          namespace: request.payload.namespace,
          kind: "HelmRelease",
          apiVersion: "helm.fluxcd.io/v1",
        });
      } catch (e) {
        console.log(e);
      }
      return;
    }

    return;
  }

  navigationHandler(): octant.Navigation {
    let nav = new c.Navigation("Helm", "helm-plugin", "cloud");
    return nav;
  }

  contentHandler(request: octant.ContentRequest): octant.ContentResponse {
    const namespace = this.dashboardClient.Namespace();

    let contentPath = request.contentPath;
    let title = [c.createText("Helm Operator Plugin")];
    if (contentPath.length > 0) {
      title.push(c.createText(contentPath));
    }

    const searchLayout = searchTable(this.querySubject, this.chartListSubject);
    const installedLayout = installedTable(this.dashboardClient, namespace);

    return {
      content: {
        title: title,
        viewComponents: [searchLayout, installedLayout],
      },
    };
  }
}

console.log("loading helm-operator-plugin");
